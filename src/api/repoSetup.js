import { cleanReason, getCachedIssueEnrichmentEntry, getStorage, isoFromMs, nowMs, saveIssueEnrichmentEntry } from './enrichmentCache.js';
import { createReadOnlyGitHubRequestOptions, rateLimitFromReadOnlyResponse } from './githubReadOnly.js';
import { getCanonicalIssueKey, getRepoDisplayName } from '../issueKeys.js';

const REPO_SETUP_CACHE_TYPE = 'repo-setup';
const SETUP_PATHS = [
  'README.md',
  'CONTRIBUTING.md',
  'package.json',
  'pyproject.toml',
  'pom.xml',
  '.github/workflows'
];

function repoParts(issue) {
  const key = getCanonicalIssueKey(issue);
  const repoDisplay = getRepoDisplayName(issue);
  if (!key || !repoDisplay) return null;
  const [owner, repo] = String(repoDisplay).split('/');
  if (!owner || !repo) return null;
  return { owner, repo };
}

function hasSafeGitHubIssueUrl(issue) {
  if (!issue?.html_url) return true;
  try {
    const url = new URL(issue.html_url);
    const segments = url.pathname.split('/').filter(Boolean);
    return url.protocol === 'https:'
      && url.hostname === 'github.com'
      && segments.length >= 4
      && (segments[2] === 'issues' || segments[2] === 'pull')
      && /^\d+$/.test(segments[3]);
  } catch {
    return false;
  }
}

function normalizeRepoSetupSummary(summary = {}) {
  const reasons = Array.isArray(summary.reasons)
    ? summary.reasons.map(cleanReason).filter(Boolean).slice(0, 8)
    : [];
  return {
    inspected: Boolean(summary.inspected),
    filesChecked: Math.max(0, Number.parseInt(summary.filesChecked, 10) || 0),
    setupDocsPresent: Boolean(summary.setupDocsPresent),
    contributingPresent: Boolean(summary.contributingPresent),
    workflowPresent: Boolean(summary.workflowPresent),
    configHintsPresent: Boolean(summary.configHintsPresent),
    testHintsPresent: Boolean(summary.testHintsPresent),
    setupUnclear: Boolean(summary.setupUnclear),
    reasons
  };
}

function decodeContent(item) {
  if (!item || item.encoding !== 'base64' || !item.content || Number(item.size || 0) > 40000) return '';
  try {
    return globalThis.atob(String(item.content).replace(/\s+/g, ''));
  } catch {
    return '';
  }
}

function summarizeFetchedItems(items = []) {
  const found = new Map(items.filter(item => item && item.ok).map(item => [item.path, item.data]));
  const workflows = found.get('.github/workflows');
  const packageJson = found.get('package.json');
  const pyproject = found.get('pyproject.toml');
  const pom = found.get('pom.xml');
  const packageText = decodeContent(packageJson);
  const pyprojectText = decodeContent(pyproject);
  const pomText = decodeContent(pom);
  const configText = [packageText, pyprojectText, pomText].join('\n').toLowerCase();

  const setupDocsPresent = found.has('README.md');
  const contributingPresent = found.has('CONTRIBUTING.md');
  const workflowPresent = Array.isArray(workflows)
    ? workflows.some(item => item?.type === 'file')
    : Boolean(workflows);
  const configHintsPresent = Boolean(packageJson || pyproject || pom);
  const testHintsPresent = /\b(test|vitest|jest|pytest|mvn test|gradle test)\b/.test(configText)
    || /"test"\s*:/.test(packageText);
  const setupUnclear = !setupDocsPresent && !contributingPresent && !workflowPresent && !configHintsPresent;

  const reasons = [];
  if (setupDocsPresent) reasons.push('Setup docs found');
  if (contributingPresent) reasons.push('Contributing guide found');
  if (workflowPresent) reasons.push('CI workflow found');
  if (testHintsPresent || configHintsPresent) reasons.push('Test/build hints found');
  if (setupUnclear) reasons.push('Setup files look unclear');

  return normalizeRepoSetupSummary({
    inspected: true,
    filesChecked: items.length,
    setupDocsPresent,
    contributingPresent,
    workflowPresent,
    configHintsPresent,
    testHintsPresent,
    setupUnclear,
    reasons
  });
}

export function buildRepoContentsApiUrl(issue, repoPath) {
  const parts = repoParts(issue);
  if (!parts || !hasSafeGitHubIssueUrl(issue)) {
    throw new Error('Cannot inspect repo setup without a valid GitHub issue reference.');
  }
  const normalizedPath = String(repoPath || '').split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(parts.owner)}/${encodeURIComponent(parts.repo)}/contents/${normalizedPath}`;
}

export function saveRepoSetupEnrichment(issue, summary, storage = getStorage(), options = {}) {
  return saveIssueEnrichmentEntry(issue, REPO_SETUP_CACHE_TYPE, normalizeRepoSetupSummary(summary), storage, options);
}

export function getCachedRepoSetupEnrichment(issue, storage = getStorage(), options = {}) {
  const entry = getCachedIssueEnrichmentEntry(issue, REPO_SETUP_CACHE_TYPE, storage, options);
  return entry ? { ...entry, summary: normalizeRepoSetupSummary(entry.summary) } : null;
}

export async function fetchRepoSetupEnrichment(issue, options = {}) {
  const storage = getStorage(options.storage);
  const cached = options.forceRefresh ? null : getCachedRepoSetupEnrichment(issue, storage, options);
  if (cached) {
    return { summary: cached.summary, fromCache: true, cached: true, rateLimit: null };
  }

  const token = options.token || '';
  const fetchImpl = options.fetchImpl || fetch;
  const fetched = [];
  let lastRateLimit = null;

  for (const repoPath of SETUP_PATHS) {
    const url = buildRepoContentsApiUrl(issue, repoPath);
    const response = await fetchImpl(url, createReadOnlyGitHubRequestOptions(url, token));
    lastRateLimit = rateLimitFromReadOnlyResponse(response, 'core', { now: isoFromMs(nowMs(options)) });
    if (response.status === 404) {
      fetched.push({ path: repoPath, ok: false });
      continue;
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub repo setup failed with status code ${response.status}`);
    }
    fetched.push({ path: repoPath, ok: true, data: await response.json() });
  }

  const summary = summarizeFetchedItems(fetched);
  const cachedEntry = saveRepoSetupEnrichment(issue, summary, storage, {
    now: nowMs(options),
    tokenUsed: Boolean(String(token).trim())
  });

  return {
    summary,
    fromCache: false,
    cached: Boolean(cachedEntry),
    rateLimit: lastRateLimit
  };
}
