import { store } from '../state/store.js';
import { isGitHubApiUrl } from '../security.js';
import { buildExactIssueApiUrl } from '../lookup.js';
import { extractRepoFullName, filterIssuesByStars, getStarsThreshold, hydrateIssueRepositories, setCachedRepoMetadata } from './repoMetadata.js';

// Simple in-memory cache
let recentSearchCache = null;

const REPO_DISCOVERY_REPO_LIMIT = 5;
const REPO_DISCOVERY_ISSUE_LIMIT = 20;
const CURATED_REPO_DISCOVERY_STARS = 5000;

function quoteGitHubValue(value) {
  const clean = String(value || '').trim().replace(/"/g, '\\"');
  if (!clean) return '';
  return /^[a-z0-9_.-]+$/i.test(clean) ? clean : `"${clean}"`;
}

function quoteGitHubLabel(value) {
  return `"${String(value || '').trim().replace(/"/g, '\\"')}"`;
}

function appendLabelFilters(parts, labels = []) {
  const labelQueries = labels
    .map(label => String(label || '').trim())
    .filter(Boolean)
    .map(quoteGitHubLabel);
  if (!labelQueries.length) return;

  if (labelQueries.length === 1) {
    parts.push(...labelQueries.map(label => `label:${label}`));
  } else {
    parts.push(`label:${labelQueries.join(',')}`);
  }
}

/**
 * Build standard GitHub search query q parameter
 */
export function buildQueryString(queryText, filters, options = {}) {
  const mode = options.mode || filters?.mode || 'find';
  const useLookupFilters = mode !== 'lookup' || Boolean(filters?.useFiltersInLookup);
  let parts = ['is:issue'];

  if (mode === 'find') {
    if (!filters.includeClosed) {
      parts.push('state:open');
    }
    parts.push('archived:false');
  } else if (useLookupFilters && !filters.includeClosed) {
    parts.push('state:open');
  }

  if (queryText && queryText.trim().length > 0) {
    parts.push(queryText.trim());
  }

  if (mode === 'lookup' && !useLookupFilters) {
    return parts.join(' ');
  }

  // Languages filter
  if (filters.languages && filters.languages.length > 0) {
    // If multiple languages are selected, we search for them
    // E.g. (language:TypeScript OR language:Rust)
    const langQueries = filters.languages
      .map(lang => quoteGitHubValue(lang))
      .filter(Boolean)
      .map(lang => `language:${lang}`);
    if (langQueries.length === 1) {
      parts.push(langQueries[0]);
    } else if (langQueries.length > 1) {
      parts.push(`(${langQueries.join(' OR ')})`);
    }
  }

  // Labels filter
  if (filters.labels && filters.labels.length > 0) {
    appendLabelFilters(parts, filters.labels);
  }

  // Comments filter
  if (filters.comments && filters.comments !== 'Any') {
    if (filters.comments === 'Low (0-5)') parts.push('comments:0..5');
    else if (filters.comments === 'Medium (6-15)') parts.push('comments:6..15');
    else if (filters.comments === 'High (15+)') parts.push('comments:>15');
  }

  // Updated Date filter
  if (filters.updatedDate && filters.updatedDate !== 'Any') {
    const now = new Date();
    if (filters.updatedDate === 'Last 24h') {
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      parts.push(`updated:>=${past.toISOString().split('T')[0]}`);
    } else if (filters.updatedDate === 'Last week') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      parts.push(`updated:>=${past.toISOString().split('T')[0]}`);
    } else if (filters.updatedDate === 'Last month') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      parts.push(`updated:>=${past.toISOString().split('T')[0]}`);
    }
  }

  if (filters.unassigned) {
    parts.push('no:assignee');
  }

  return parts.join(' ');
}

export function buildQueryPreview(queryText, filters, options = {}) {
  return buildQueryString(queryText, filters, options);
}

export function buildSearchIssuesUrl(queryText, filters, options = {}) {
  const q = buildQueryString(queryText, filters, options);
  let sortParam = '';
  const orderParam = 'desc';
  const mode = options.mode || filters?.mode || 'find';
  const canApplySort = mode !== 'lookup' || Boolean(filters?.useFiltersInLookup);

  if (canApplySort && filters.sortMode === 'Updated Date') {
    sortParam = 'updated';
  } else if (canApplySort && filters.sortMode === 'Most Commented') {
    sortParam = 'comments';
  } else if (canApplySort && filters.sortMode === 'Recently Created') {
    sortParam = 'created';
  }

  let url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}`;
  if (sortParam) {
    url += `&sort=${sortParam}&order=${orderParam}`;
  }
  return url;
}

function cleanList(value) {
  return Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : [];
}

function getLabelNames(labels = []) {
  return (Array.isArray(labels) ? labels : [])
    .map(label => typeof label === 'string' ? label : label?.name)
    .map(label => String(label || '').trim().toLowerCase())
    .filter(Boolean);
}

function issueMatchesSelectedLabels(issue, filters = {}) {
  const selectedLabels = cleanList(filters.labels).map(label => label.toLowerCase());
  if (!selectedLabels.length) return true;
  const issueLabels = getLabelNames(issue?.labels);
  return selectedLabels.some(label => issueLabels.includes(label));
}

function issueMatchesCommentFilter(issue, filters = {}) {
  const comments = Number(issue?.comments || 0);
  if (filters.comments === 'Low (0-5)') return comments >= 0 && comments <= 5;
  if (filters.comments === 'Medium (6-15)') return comments >= 6 && comments <= 15;
  if (filters.comments === 'High (15+)') return comments > 15;
  return true;
}

function getUpdatedSinceDate(updatedDate) {
  const now = new Date();
  if (updatedDate === 'Last 24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (updatedDate === 'Last week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (updatedDate === 'Last month') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

function issueMatchesUpdatedDateFilter(issue, filters = {}) {
  const since = getUpdatedSinceDate(filters.updatedDate);
  if (!since) return true;
  const updatedAt = Date.parse(issue?.updated_at || '');
  return Number.isFinite(updatedAt) && updatedAt >= since.getTime();
}

function issueMatchesLanguageFilter(issue, filters = {}) {
  const languages = cleanList(filters.languages).map(language => language.toLowerCase());
  if (!languages.length) return true;
  return languages.includes(String(issue?.repository?.language || '').toLowerCase());
}

function issueMatchesSearchText(issue, searchText = '') {
  const terms = String(searchText || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const labelText = getLabelNames(issue?.labels).join(' ');
  const haystack = [
    issue?.title,
    issue?.body,
    issue?.repository?.full_name,
    labelText
  ].map(value => String(value || '').toLowerCase()).join(' ');
  return terms.every(term => haystack.includes(term));
}

function issueMatchesAssignmentFilter(issue, filters = {}) {
  if (!filters.unassigned) return true;
  return !issue?.assignee && !(Array.isArray(issue?.assignees) && issue.assignees.length);
}

function issueMatchesStateFilter(issue, filters = {}) {
  if (filters.includeClosed) return true;
  return String(issue?.state || 'open').toLowerCase() === 'open';
}

function filterIssuesByHardFilters(issues, filters = {}) {
  return filterIssuesByStars(issues, filters.stars)
    .filter(issue => issueMatchesStateFilter(issue, filters))
    .filter(issue => issueMatchesSelectedLabels(issue, filters))
    .filter(issue => issueMatchesCommentFilter(issue, filters))
    .filter(issue => issueMatchesUpdatedDateFilter(issue, filters))
    .filter(issue => issueMatchesAssignmentFilter(issue, filters))
    .filter(issue => issueMatchesLanguageFilter(issue, filters));
}

function issueDiscoveryKey(issue) {
  if (issue?.id !== undefined && issue?.id !== null) return `id:${issue.id}`;
  const fullName = extractRepoFullName(issue) || issue?.repository?.full_name || '';
  const number = Number.parseInt(issue?.number, 10);
  if (fullName && Number.isFinite(number)) return `${fullName.toLowerCase()}#${number}`;
  return String(issue?.html_url || '').toLowerCase();
}

function dedupeIssues(issues = []) {
  const seen = new Set();
  const unique = [];
  for (const issue of issues) {
    const key = issueDiscoveryKey(issue);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(issue);
  }
  return unique;
}

function encodeOwnerRepo(fullName) {
  const [owner, repo] = String(fullName || '').split('/');
  if (!owner || !repo) return null;
  return {
    owner,
    repo,
    ownerPath: encodeURIComponent(owner),
    repoPath: encodeURIComponent(repo)
  };
}

function parseRepoDiscoveryContext(queryText = '') {
  const source = String(queryText || '').trim();
  const repos = [];
  let remaining = source;
  const repoPattern = /(?:^|\s)(repo:)?([a-z0-9_.-]+\/[a-z0-9_.-]+)(?=\s|$)/ig;
  remaining = source.replace(repoPattern, (match, prefix, fullName) => {
    if (prefix || match.trim() === fullName) {
      repos.push(fullName);
      return ' ';
    }
    return match;
  });

  return {
    repos: [...new Set(repos.map(repo => repo.toLowerCase()))],
    remainingText: remaining.replace(/\s+/g, ' ').trim()
  };
}

function buildRepositorySearchQueries(queryText, filters = {}) {
  const { repos, remainingText } = parseRepoDiscoveryContext(queryText);
  if (repos.length) return [];

  const threshold = getStarsThreshold(filters.stars);
  const shouldUseCuratedHighStars = !threshold && filters.difficulty && filters.difficulty !== 'Any';
  if (!threshold && !shouldUseCuratedHighStars) return [];

  const baseParts = [];
  if (remainingText) baseParts.push(remainingText);
  baseParts.push(`stars:>=${threshold || CURATED_REPO_DISCOVERY_STARS}`);
  baseParts.push('archived:false');

  const languages = cleanList(filters.languages);
  const languageVariants = languages.length ? languages : [null];
  return languageVariants.map(language => {
    const parts = [...baseParts];
    if (language) parts.push(`language:${quoteGitHubValue(language)}`);
    return parts.join(' ');
  });
}

function buildRepositorySearchUrl(query) {
  return `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${REPO_DISCOVERY_REPO_LIMIT}`;
}

function buildRepositoryIssuesUrl(fullName, filters = {}) {
  const parts = encodeOwnerRepo(fullName);
  if (!parts) return null;
  const params = new URLSearchParams({
    state: filters.includeClosed ? 'all' : 'open',
    sort: 'updated',
    direction: 'desc',
    per_page: String(REPO_DISCOVERY_ISSUE_LIMIT)
  });
  const since = getUpdatedSinceDate(filters.updatedDate);
  if (since) params.set('since', since.toISOString());
  if (filters.unassigned) params.set('assignee', 'none');
  return `https://api.github.com/repos/${parts.ownerPath}/${parts.repoPath}/issues?${params.toString()}`;
}

function tagDiscoverySource(issue, source) {
  const sources = Array.isArray(issue.discovery_sources) ? issue.discovery_sources : [];
  return {
    ...issue,
    discovery_sources: sources.includes(source) ? sources : [...sources, source],
    discovery_source: issue.discovery_source || source
  };
}

async function fetchRepoIssues(fullName, filters, options) {
  const url = buildRepositoryIssuesUrl(fullName, filters);
  if (!url) return [];
  const response = await options.fetchImpl(url, createGitHubRequestOptions(url, options.token));
  store.setRateLimit(rateLimitFromResponse(response, 'core'), 'core');

  if (!response.ok) return [];
  const data = await response.json();
  return (Array.isArray(data) ? data : [])
    .filter(item => !item.pull_request)
    .map(normalizeGitHubIssue)
    .map(issue => tagDiscoverySource(issue, 'repo-discovery'));
}

async function fetchRepositoryDiscoveryIssues(queryText, filters, options) {
  const context = parseRepoDiscoveryContext(queryText);
  const sourceQueries = [];
  const repos = new Map();

  for (const fullName of context.repos) {
    repos.set(fullName, { full_name: fullName });
  }

  for (const query of buildRepositorySearchQueries(queryText, filters)) {
    const url = buildRepositorySearchUrl(query);
    sourceQueries.push(`repos: ${query}`);
    const response = await options.fetchImpl(url, createGitHubRequestOptions(url, options.token));
    store.setRateLimit(rateLimitFromResponse(response, 'search'), 'search');
    if (!response.ok) continue;
    const data = await response.json();
    for (const repo of data.items || []) {
      if (!repo?.full_name || repos.has(String(repo.full_name).toLowerCase())) continue;
      repos.set(String(repo.full_name).toLowerCase(), repo);
      setCachedRepoMetadata(repo.full_name, repo);
    }
  }

  const issues = [];
  for (const repo of repos.values()) {
    if (!repo?.full_name) continue;
    sourceQueries.push(`GET /repos/${repo.full_name}/issues`);
    const repoIssues = await fetchRepoIssues(repo.full_name, filters, options);
    issues.push(...repoIssues.filter(issue => issueMatchesSearchText(issue, context.repos.length ? context.remainingText : '')));
  }

  return { issues, sourceQueries };
}

function normalizeSearchCacheFilters(filters = {}) {
  return {
    languages: cleanList(filters.languages),
    labels: cleanList(filters.labels),
    difficulty: filters.difficulty || 'Any',
    stars: filters.stars || 'Any',
    comments: filters.comments || 'Any',
    updatedDate: filters.updatedDate || 'Any',
    includeClosed: Boolean(filters.includeClosed),
    unassigned: Boolean(filters.unassigned)
  };
}

function buildQueryPreviewFromDiagnostics(fallbackQuery, diagnostics) {
  const sourceQueries = diagnostics?.sourceQueries || [];
  return sourceQueries.length ? sourceQueries.join('\n') : fallbackQuery;
}

function repositoryFromApiUrl(repositoryUrl) {
  try {
    const url = new URL(repositoryUrl || '');
    const segments = url.pathname.split('/').filter(Boolean);
    if (url.protocol === 'https:' && url.hostname === 'api.github.com' && segments.length === 3 && segments[0] === 'repos') {
      return {
        owner: { login: segments[1] },
        name: segments[2],
        full_name: `${segments[1]}/${segments[2]}`,
        url: repositoryUrl
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeGitHubIssue(issue) {
  const repository = issue.repository?.full_name
    ? issue.repository
    : repositoryFromApiUrl(issue.repository_url);

  return {
    ...issue,
    repository: repository || issue.repository || { name: 'github', full_name: 'github' }
  };
}

export function createGitHubHeaders(url, token = '') {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const trimmedToken = String(token || '').trim();
  if (trimmedToken && isGitHubApiUrl(url)) {
    headers.Authorization = `Bearer ${trimmedToken}`;
  }

  return headers;
}

export function createGitHubRequestOptions(url, token = '', init = {}) {
  if (!isGitHubApiUrl(url)) {
    throw new Error('GitHub API request blocked: only https://api.github.com requests are allowed.');
  }

  const method = String(init.method || 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    throw new Error('GitHub API request blocked: v0.1 is read-only.');
  }

  return {
    ...init,
    method,
    headers: {
      ...createGitHubHeaders(url, token),
      ...(init.headers || {})
    }
  };
}

function getFetchImpl(fetchImpl) {
  return fetchImpl || ((url, init) => globalThis.fetch(url, init));
}

export class GitHubRefreshRateLimitError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'GitHubRefreshRateLimitError';
    this.isRateLimit = true;
    this.status = details.status ?? null;
    this.rateLimit = details.rateLimit || { remaining: null, limit: null, reset: null };
    this.retryAfter = details.retryAfter ?? null;
  }
}

function getIssueApiUrl(issue) {
  const number = Number.parseInt(issue?.number, 10);
  const fullName = issue?.repository?.full_name;
  if (fullName && Number.isFinite(number) && number > 0) {
    const [owner, repo] = fullName.split('/');
    if (owner && repo) {
      return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}`;
    }
  }

  try {
    const url = new URL(issue?.html_url || '');
    const segments = url.pathname.split('/').filter(Boolean);
    if (url.protocol === 'https:' && url.hostname === 'github.com' && segments.length >= 4 && segments[2] === 'issues') {
      return `https://api.github.com/repos/${encodeURIComponent(segments[0])}/${encodeURIComponent(segments[1])}/issues/${encodeURIComponent(segments[3])}`;
    }
  } catch {
    return null;
  }

  return null;
}

function retryAfterFromResponse(response) {
  const retryAfter = response.headers.get('retry-after');
  const number = retryAfter ? parseInt(retryAfter, 10) : null;
  return Number.isFinite(number) ? number : null;
}

function parseRateLimitNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

export function normalizeRateLimitResource(value, fallback = 'core') {
  const resource = String(value || '').toLowerCase();
  if (resource === 'core') return 'core';
  if (resource === 'search') return 'search';
  return fallback === 'search' ? 'search' : 'core';
}

export function rateLimitFromResponse(response, fallbackResource = 'core', options = {}) {
  const resource = normalizeRateLimitResource(
    response.headers.get('x-ratelimit-resource'),
    fallbackResource
  );

  return {
    resource,
    remaining: parseRateLimitNumber(response.headers.get('x-ratelimit-remaining')),
    limit: parseRateLimitNumber(response.headers.get('x-ratelimit-limit')),
    used: parseRateLimitNumber(response.headers.get('x-ratelimit-used')),
    reset: parseRateLimitNumber(response.headers.get('x-ratelimit-reset')),
    updatedAt: options.now || new Date().toISOString()
  };
}

function normalizeRateLimitBucket(data, resource, options = {}) {
  if (!data || typeof data !== 'object') return null;
  return {
    resource,
    limit: parseRateLimitNumber(data.limit),
    remaining: parseRateLimitNumber(data.remaining),
    used: parseRateLimitNumber(data.used),
    reset: parseRateLimitNumber(data.reset),
    updatedAt: options.now || new Date().toISOString()
  };
}

export function normalizeRateLimitStatusPayload(payload, options = {}) {
  const now = options.now || new Date().toISOString();
  const resources = payload?.resources || {};
  return {
    core: normalizeRateLimitBucket(resources.core, 'core', { now }),
    search: normalizeRateLimitBucket(resources.search, 'search', { now }),
    lastCheckedAt: now
  };
}

function isRefreshRateLimitResponse(response, errorData, rateLimit) {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;

  const message = String(errorData?.message || '').toLowerCase();
  return rateLimit.remaining === 0
    || Boolean(response.headers.get('retry-after'))
    || message.includes('rate limit')
    || message.includes('abuse detection');
}

export async function fetchIssueMetadataForRefresh(issue, options = {}) {
  const url = getIssueApiUrl(issue);
  if (!url) {
    throw new Error('Cannot refresh issue metadata because the saved card does not have a valid GitHub issue URL.');
  }

  const etag = options.etag || issue?.github_activity?.etag || '';
  const headers = etag ? { 'If-None-Match': etag } : {};
  const token = options.token ?? store.githubToken;
  const fetchImpl = getFetchImpl(options.fetchImpl);
  const response = await fetchImpl(url, createGitHubRequestOptions(url, token, { headers }));

  const rateLimit = rateLimitFromResponse(response, 'core');
  store.setRateLimit(rateLimit, 'core');
  const responseEtag = response.headers.get('etag') || etag || '';

  if (response.status === 304) {
    return {
      notModified: true,
      issue: null,
      etag: responseEtag,
      rateLimit,
      retryAfter: retryAfterFromResponse(response)
    };
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (isRefreshRateLimitResponse(response, errorData, rateLimit)) {
      throw new GitHubRefreshRateLimitError(errorData.message || 'GitHub API rate limit reached.', {
        status: response.status,
        rateLimit,
        retryAfter: retryAfterFromResponse(response)
      });
    }
    throw new Error(errorData.message || `GitHub issue refresh failed with status code ${response.status}`);
  }

  return {
    notModified: false,
    issue: normalizeGitHubIssue(await response.json()),
    etag: responseEtag,
    rateLimit,
    retryAfter: retryAfterFromResponse(response)
  };
}

export async function fetchIssueMetadata(issue) {
  const result = await fetchIssueMetadataForRefresh(issue);
  return result.notModified ? normalizeGitHubIssue(issue) : result.issue;
}

function getLookupRepoContextFromIssue(issue) {
  return extractRepoFullName(issue) || issue?.repository?.full_name || '';
}

export async function fetchExactIssue(reference, options = {}) {
  const url = buildExactIssueApiUrl(reference);
  const mode = 'lookup';
  const fetchImpl = getFetchImpl(options.fetchImpl);
  store.setSearchState(true, null);

  try {
    const response = await fetchImpl(url, createGitHubRequestOptions(url, options.token ?? store.githubToken));
    const rateLimitInfo = rateLimitFromResponse(response, 'core');
    store.setRateLimit(rateLimitInfo, 'core');

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub exact issue lookup failed with status code ${response.status}`);
    }

    const issue = normalizeGitHubIssue(await response.json());
    const hydrated = await hydrateIssueRepositories([issue], {
      token: options.token ?? store.githubToken,
      forceRefresh: Boolean(options.forceRepoRefresh),
      fetchImpl
    });
    const queryPreview = `GET ${buildExactIssueApiUrl(reference)}`;
    store.setLastSearchMetadata({
      mode,
      queryPreview,
      lookupRepoContext: getLookupRepoContextFromIssue(hydrated[0])
    });
    store.setSearchState(false, null, hydrated);
    return hydrated[0];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub exact issue lookup failed.';
    store.setSearchState(false, message, null);
    throw error;
  }
}

/**
 * Query GitHub REST API
 */
export async function searchGitHubIssues(queryText, forceRefresh = false, options = {}) {
  const filters = options.filters || store.filters;
  const mode = options.mode || store.finderMode || 'find';
  const q = buildQueryString(queryText, filters, { mode });
  
  // Resolve sort fields
  let sortParam = '';
  let orderParam = 'desc';
  const canApplySort = mode !== 'lookup' || Boolean(filters?.useFiltersInLookup);

  if (canApplySort && filters.sortMode === 'Updated Date') {
    sortParam = 'updated';
  } else if (canApplySort && filters.sortMode === 'Most Commented') {
    sortParam = 'comments';
  } else if (canApplySort && filters.sortMode === 'Recently Created') {
    sortParam = 'created';
  }

  // Check in-memory cache
  const cacheKey = JSON.stringify({
    mode,
    q,
    sortParam,
    orderParam,
    filters: normalizeSearchCacheFilters(filters)
  });
  if (!forceRefresh && recentSearchCache && recentSearchCache.key === cacheKey) {
    // Update store with cached rate limits
    if (recentSearchCache.rateLimit) {
      store.setRateLimit(recentSearchCache.rateLimit, 'search');
    }
    store.setLastSearchMetadata({
      mode,
      queryPreview: recentSearchCache.queryPreview || q,
      lookupRepoContext: recentSearchCache.results.map(getLookupRepoContextFromIssue).find(Boolean) || store.lookupRepoContext,
      diagnostics: recentSearchCache.diagnostics || null
    });
    store.setSearchState(false, null, recentSearchCache.results);
    return recentSearchCache.results;
  }

  store.setSearchState(true, null);

  const token = options.token ?? store.githubToken;
  const fetchImpl = getFetchImpl(options.fetchImpl);
  const url = buildSearchIssuesUrl(queryText, filters, { mode });

  try {
    const response = await fetchImpl(url, createGitHubRequestOptions(url, token));

    // Parse rate limits from headers
    const rateLimitInfo = rateLimitFromResponse(response, 'search');
    store.setRateLimit(rateLimitInfo, 'search');

    if (!response.ok) {
      // Handle rate limits and forbidden status
      if (response.status === 403 || response.status === 429) {
        let errorMsg = "GitHub API Rate Limit exceeded. ";
        if (!token) {
          errorMsg += "Authenticate with a GitHub Personal Access Token in Settings to receive higher rate limits.";
        } else {
          errorMsg += "Your token rate limits are temporarily fully exhausted. Please try again later.";
        }
        throw new Error(errorMsg);
      } else if (response.status === 401) {
        throw new Error("Invalid GitHub Personal Access Token. Please check your credentials in the Settings screen.");
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `GitHub API request failed with status code ${response.status}`);
      }
    }

    const data = await response.json();
    
    // Filter out pull requests just in case (is:issue usually takes care of it, but good to be safe)
    const directItems = (data.items || [])
      .filter(item => !item.pull_request)
      .map(normalizeGitHubIssue)
      .map(issue => tagDiscoverySource(issue, 'issue-search'));
    const diagnostics = {
      sourceQueries: [`issues: ${q}`],
      fetchedCount: directItems.length,
      dedupedCount: 0,
      hydratedCount: 0,
      hardFilteredCount: 0,
      visibleCount: null
    };
    let discoveredItems = [];
    if (mode === 'find') {
      const discovery = await fetchRepositoryDiscoveryIssues(queryText, filters, {
        token,
        fetchImpl,
        forceRefresh: Boolean(options.forceRepoRefresh)
      });
      discoveredItems = discovery.issues;
      diagnostics.sourceQueries.push(...discovery.sourceQueries);
      diagnostics.fetchedCount += discoveredItems.length;
    }

    const items = dedupeIssues([...directItems, ...discoveredItems]);
    diagnostics.dedupedCount = items.length;

    const hydratedItems = await hydrateIssueRepositories(items, {
      token,
      forceRefresh: Boolean(options.forceRepoRefresh),
      fetchImpl
    });
    diagnostics.hydratedCount = hydratedItems.length;

    const locallyFilteredItems = (mode === 'find' || filters.useFiltersInLookup)
      ? filterIssuesByHardFilters(hydratedItems, filters)
      : hydratedItems;
    diagnostics.hardFilteredCount = locallyFilteredItems.length;
    const queryPreview = buildQueryPreviewFromDiagnostics(q, diagnostics);

    // Save in-memory cache
    recentSearchCache = {
      key: cacheKey,
      results: locallyFilteredItems,
      rateLimit: rateLimitInfo,
      queryPreview,
      diagnostics
    };

    const firstRepo = locallyFilteredItems.map(getLookupRepoContextFromIssue).find(Boolean) || store.lookupRepoContext;
    store.setLastSearchMetadata({
      mode,
      queryPreview,
      lookupRepoContext: firstRepo,
      diagnostics
    });
    store.setSearchState(false, null, locallyFilteredItems);
    return locallyFilteredItems;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub API request failed.';
    store.setSearchState(false, message, null);
    throw error;
  }
}

export async function fetchGitHubRateLimitStatus(options = {}) {
  const url = 'https://api.github.com/rate_limit';
  const token = options.token ?? store.githubToken;
  const fetchImpl = getFetchImpl(options.fetchImpl);
  const response = await fetchImpl(url, createGitHubRequestOptions(url, token));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `GitHub rate-limit status failed with status code ${response.status}`);
  }

  return normalizeRateLimitStatusPayload(await response.json(), { now: options.now });
}

export async function fetchGitHubUserForToken(token, options = {}) {
  const url = 'https://api.github.com/user';
  const fetchImpl = getFetchImpl(options.fetchImpl);
  const response = await fetchImpl(url, createGitHubRequestOptions(url, token));
  const rateLimit = rateLimitFromResponse(response, 'core');
  const tokenValue = String(token || '').trim();
  const activeToken = String(store.githubToken || '').trim();
  const shouldTrackRateLimit = options.trackRateLimit === true
    || (options.trackRateLimit !== false && tokenValue && tokenValue === activeToken);
  if (shouldTrackRateLimit) {
    store.setRateLimit(rateLimit, 'core');
  }

  if (!response.ok) {
    throw new Error(`Auth test rejected: ${response.statusText} (${response.status})`);
  }

  return response.json();
}
