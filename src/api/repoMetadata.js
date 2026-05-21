import { isGitHubApiUrl } from '../security.js';

export const REPO_METADATA_CACHE_KEY = 'pr_dashboard_repo_metadata_cache_v1';
export const REPO_METADATA_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENCY = 4;

const memoryCache = new Map();

function getStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function readStoredCache() {
  const storage = getStorage();
  if (!storage) return {};
  try {
    return JSON.parse(storage.getItem(REPO_METADATA_CACHE_KEY) || '{}') || {};
  } catch {
    storage.removeItem(REPO_METADATA_CACHE_KEY);
    return {};
  }
}

function writeStoredCache(cache) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(REPO_METADATA_CACHE_KEY, JSON.stringify(cache));
}

function sanitizeRepoMetadata(repo) {
  return {
    full_name: String(repo?.full_name || ''),
    name: String(repo?.name || String(repo?.full_name || '').split('/')[1] || ''),
    stargazers_count: Number(repo?.stargazers_count || 0),
    forks_count: Number(repo?.forks_count || 0),
    open_issues_count: Number(repo?.open_issues_count || 0),
    pushed_at: repo?.pushed_at || null,
    archived: Boolean(repo?.archived),
    disabled: Boolean(repo?.disabled),
    default_branch: repo?.default_branch || null,
    language: repo?.language || null,
    topics: Array.isArray(repo?.topics) ? repo.topics.slice(0, 20).map(String) : []
  };
}

function cachedEntryIsFresh(entry, now) {
  return entry && entry.fetchedAt && now - entry.fetchedAt < REPO_METADATA_TTL_MS;
}

export function clearRepoMetadataCache() {
  memoryCache.clear();
  getStorage()?.removeItem(REPO_METADATA_CACHE_KEY);
}

export function setCachedRepoMetadata(fullName, metadata, options = {}) {
  const now = options.now ?? Date.now();
  const clean = sanitizeRepoMetadata({ ...metadata, full_name: fullName || metadata?.full_name });
  if (!clean.full_name) return null;

  const entry = { fetchedAt: now, data: clean };
  memoryCache.set(clean.full_name, entry);

  const stored = readStoredCache();
  stored[clean.full_name] = entry;
  writeStoredCache(stored);
  return clean;
}

export function getCachedRepoMetadata(fullName, options = {}) {
  const now = options.now ?? Date.now();
  const key = String(fullName || '');
  const memoryEntry = memoryCache.get(key);
  if (cachedEntryIsFresh(memoryEntry, now)) return memoryEntry.data;

  const storedEntry = readStoredCache()[key];
  if (cachedEntryIsFresh(storedEntry, now)) {
    memoryCache.set(key, storedEntry);
    return storedEntry.data;
  }

  return null;
}

export function extractRepoFullName(issue) {
  if (issue?.repository?.full_name) return String(issue.repository.full_name);
  const repositoryUrl = issue?.repository_url || issue?.repository?.url;
  try {
    const url = new URL(repositoryUrl || '');
    const segments = url.pathname.split('/').filter(Boolean);
    if (url.protocol === 'https:' && url.hostname === 'api.github.com' && segments.length === 3 && segments[0] === 'repos') {
      return `${segments[1]}/${segments[2]}`;
    }
  } catch {
    return null;
  }
  return null;
}

function repoApiUrl(fullName) {
  const [owner, repo] = String(fullName || '').split('/');
  if (!owner || !repo) return null;
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function createRepoMetadataRequestOptions(url, token = '') {
  if (!isGitHubApiUrl(url)) {
    throw new Error('GitHub repository metadata request blocked: only https://api.github.com requests are allowed.');
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const trimmedToken = String(token || '').trim();
  if (trimmedToken) {
    headers.Authorization = `Bearer ${trimmedToken}`;
  }
  return { method: 'GET', headers };
}

async function runLimited(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await tasks[current]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function fetchRepoMetadata(fullName, options) {
  const url = repoApiUrl(fullName);
  if (!url) return null;
  const response = await options.fetchImpl(url, createRepoMetadataRequestOptions(url, options.token));
  if (!response.ok) {
    throw new Error(`Repository metadata unavailable for ${fullName}.`);
  }
  const data = await response.json();
  return setCachedRepoMetadata(fullName, data, { now: options.now });
}

export async function hydrateIssueRepositories(issues, options = {}) {
  const token = options.token || '';
  const forceRefresh = Boolean(options.forceRefresh);
  const fetchImpl = options.fetchImpl || ((url, init) => globalThis.fetch(url, init));
  const now = options.now ?? Date.now();
  const uniqueRepos = [...new Set((issues || []).map(extractRepoFullName).filter(Boolean))];
  const metadataByRepo = new Map();
  const misses = [];

  for (const fullName of uniqueRepos) {
    const cached = forceRefresh ? null : getCachedRepoMetadata(fullName, { now });
    if (cached) {
      metadataByRepo.set(fullName, cached);
    } else {
      misses.push(fullName);
    }
  }

  await runLimited(misses.map(fullName => async () => {
    try {
      const metadata = await fetchRepoMetadata(fullName, { token, fetchImpl, now });
      metadataByRepo.set(fullName, metadata);
    } catch {
      metadataByRepo.set(fullName, null);
    }
  }), MAX_CONCURRENCY);

  return (issues || []).map(issue => {
    const fullName = extractRepoFullName(issue);
    if (!fullName) return issue;
    const metadata = metadataByRepo.get(fullName);
    if (!metadata) {
      return {
        ...issue,
        repository_metadata_unavailable: true,
        repository: {
          ...(issue.repository || {}),
          full_name: fullName,
          metadataUnavailable: true
        }
      };
    }
    return {
      ...issue,
      repository: {
        ...(issue.repository || {}),
        ...metadata
      }
    };
  });
}

function starsThreshold(stars) {
  if (stars === '1k+') return 1000;
  if (stars === '5k+') return 5000;
  if (stars === '10k+') return 10000;
  return 0;
}

export function repoMeetsStarsFilter(issue, stars) {
  const threshold = starsThreshold(stars);
  if (!threshold) return true;
  if (issue?.repository_metadata_unavailable || issue?.repository?.metadataUnavailable) return true;
  return Number(issue?.repository?.stargazers_count || 0) >= threshold;
}

export function filterIssuesByStars(issues, stars) {
  return (issues || []).filter(issue => repoMeetsStarsFilter(issue, stars));
}
