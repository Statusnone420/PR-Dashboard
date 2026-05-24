import { getCanonicalIssueKey, getIssueNumber, getRepoDisplayName } from '../issueKeys.js';
import { fetchPaginatedReadOnlyGitHubJson } from './githubReadOnly.js';

export const SCORE_ENRICHMENT_CACHE_KEY = 'pr_dashboard_score_enrichment_cache_v1';
export const ISSUE_COMMENTS_TTL_MS = 6 * 60 * 60 * 1000;

const MAINTAINER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const ENCOURAGEMENT_PATTERNS = [
  /\bpr welcome\b/i,
  /\bhappy to review\b/i,
  /\bsounds good\b/i,
  /\bgo ahead\b/i
];
const CLAIM_PATTERNS = [
  /\bi(?:'|’)ll take this\b/i,
  /\bi am working on this\b/i,
  /\bi'm working on this\b/i,
  /\bworking on this\b/i,
  /\bi can work on this\b/i,
  /\bopened (?:a )?(?:pr|pull request)\b/i
];
const BLOCKED_PATTERNS = [
  /\bblocked by\b/i,
  /\bduplicate of\b/i,
  /\bwaiting on\b/i
];

function getStorage(storage) {
  return storage || globalThis.localStorage || null;
}

function nowMs(options = {}) {
  const value = options.now ?? Date.now();
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function isoFromMs(value) {
  return new Date(value).toISOString();
}

function cleanReason(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function isBotComment(comment) {
  const user = comment?.user || {};
  const login = String(user.login || '').toLowerCase();
  return String(user.type || '').toLowerCase() === 'bot' || login.endsWith('[bot]');
}

function isMaintainerComment(comment) {
  return MAINTAINER_ASSOCIATIONS.has(String(comment?.author_association || '').toUpperCase());
}

function hasPattern(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function normalizeSummary(summary = {}) {
  const reasons = Array.isArray(summary.reasons)
    ? summary.reasons.map(cleanReason).filter(Boolean).slice(0, 8)
    : [];
  return {
    inspected: Boolean(summary.inspected),
    totalComments: Math.max(0, Number.parseInt(summary.totalComments, 10) || 0),
    humanComments: Math.max(0, Number.parseInt(summary.humanComments, 10) || 0),
    botComments: Math.max(0, Number.parseInt(summary.botComments, 10) || 0),
    maintainerEncouragement: Boolean(summary.maintainerEncouragement),
    ownershipClaim: Boolean(summary.ownershipClaim),
    blockedHint: Boolean(summary.blockedHint),
    botOnlyRecentActivity: Boolean(summary.botOnlyRecentActivity),
    reasons
  };
}

function createEmptyCache() {
  return {
    version: 1,
    entries: {}
  };
}

function readCache(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return createEmptyCache();
  try {
    const parsed = JSON.parse(targetStorage.getItem(SCORE_ENRICHMENT_CACHE_KEY) || '{}');
    const entries = {};
    for (const [key, entry] of Object.entries(parsed?.entries || {})) {
      if (!entry || typeof entry !== 'object') continue;
      const type = String(entry.type || 'issue-comments');
      if (type !== 'issue-comments') {
        entries[key] = {
          type,
          fetched_at: String(entry.fetched_at || ''),
          expires_at: String(entry.expires_at || ''),
          summary: entry.summary && typeof entry.summary === 'object' ? entry.summary : {}
        };
        continue;
      }
      entries[key] = {
        type: 'issue-comments',
        fetched_at: String(entry.fetched_at || ''),
        expires_at: String(entry.expires_at || ''),
        summary: normalizeSummary(entry.summary || {})
      };
    }
    return { version: 1, entries };
  } catch {
    targetStorage.removeItem(SCORE_ENRICHMENT_CACHE_KEY);
    return createEmptyCache();
  }
}

function writeCache(cache, storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (targetStorage) {
    targetStorage.setItem(SCORE_ENRICHMENT_CACHE_KEY, JSON.stringify({
      version: 1,
      entries: cache.entries || {}
    }));
  }
}

function issueKeyParts(issue) {
  const key = getCanonicalIssueKey(issue);
  const repoDisplay = getRepoDisplayName(issue);
  const number = getIssueNumber(issue);
  if (!key || !repoDisplay || !number) return null;
  const [owner, repo] = String(repoDisplay).split('/');
  if (!owner || !repo) return null;
  return { key, owner, repo, number: String(number) };
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

export function buildIssueCommentsApiUrl(issue) {
  const parts = issueKeyParts(issue);
  if (!parts || !hasSafeGitHubIssueUrl(issue)) {
    throw new Error('Cannot inspect comments without a valid GitHub issue reference.');
  }
  return `https://api.github.com/repos/${encodeURIComponent(parts.owner)}/${encodeURIComponent(parts.repo)}/issues/${parts.number}/comments?per_page=100`;
}

export function getIssueCommentsCacheKey(issue) {
  return issueKeyParts(issue)?.key || null;
}

export function summarizeIssueComments(comments = []) {
  const list = Array.isArray(comments) ? comments : [];
  let maintainerEncouragement = false;
  let ownershipClaim = false;
  let blockedHint = false;
  let humanComments = 0;
  let botComments = 0;

  for (const comment of list) {
    const text = String(comment?.body || '');
    const bot = isBotComment(comment);
    if (bot) {
      botComments += 1;
    } else {
      humanComments += 1;
    }

    if (!bot && isMaintainerComment(comment) && hasPattern(text, ENCOURAGEMENT_PATTERNS)) {
      maintainerEncouragement = true;
    }
    if (!bot && hasPattern(text, CLAIM_PATTERNS)) {
      ownershipClaim = true;
    }
    if (!bot && hasPattern(text, BLOCKED_PATTERNS)) {
      blockedHint = true;
    }
  }

  const botOnlyRecentActivity = list.length > 0 && humanComments === 0;
  const reasons = [];
  if (maintainerEncouragement) reasons.push('Maintainer appears open to PRs');
  if (ownershipClaim) reasons.push('Comment thread suggests someone may be working on this');
  if (blockedHint) reasons.push('Comment thread suggests blocked work');
  if (botOnlyRecentActivity) reasons.push('Only bot comments inspected');
  if (list.length === 0) reasons.push('No comments found');

  return normalizeSummary({
    inspected: true,
    totalComments: list.length,
    humanComments,
    botComments,
    maintainerEncouragement,
    ownershipClaim,
    blockedHint,
    botOnlyRecentActivity,
    reasons
  });
}

function canCacheIssue(issue, options = {}) {
  const repo = issue?.repository || {};
  const visibility = String(repo.visibility || '').toLowerCase();
  if (repo.private === true || visibility === 'private') return false;
  if (options.tokenUsed && repo.private !== false && visibility !== 'public') return false;
  return true;
}

export function saveIssueCommentEnrichment(issue, summary, storage = getStorage(), options = {}) {
  if (!canCacheIssue(issue, options)) return null;
  const key = getIssueCommentsCacheKey(issue);
  if (!key) return null;
  const now = nowMs(options);
  const cache = readCache(storage);
  const entry = {
    type: 'issue-comments',
    fetched_at: isoFromMs(now),
    expires_at: isoFromMs(now + ISSUE_COMMENTS_TTL_MS),
    summary: normalizeSummary(summary)
  };
  cache.entries[key] = entry;
  writeCache(cache, storage);
  return entry;
}

export function getCachedIssueCommentEnrichment(issue, storage = getStorage(), options = {}) {
  const key = getIssueCommentsCacheKey(issue);
  if (!key) return null;
  const cache = readCache(storage);
  const entry = cache.entries[key];
  if (!entry) return null;
  if (Date.parse(entry.expires_at) <= nowMs(options)) {
    delete cache.entries[key];
    writeCache(cache, storage);
    return null;
  }
  return entry;
}

export function clearScoreEnrichmentCache(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (targetStorage) {
    targetStorage.removeItem(SCORE_ENRICHMENT_CACHE_KEY);
  }
}

export async function fetchIssueCommentsEnrichment(issue, options = {}) {
  const storage = getStorage(options.storage);
  const cached = options.forceRefresh ? null : getCachedIssueCommentEnrichment(issue, storage, options);
  if (cached) {
    return { summary: cached.summary, fromCache: true, cached: true, rateLimit: null };
  }

  const url = buildIssueCommentsApiUrl(issue);
  const token = options.token || '';
  const fetchImpl = options.fetchImpl || fetch;
  const { items, rateLimit } = await fetchPaginatedReadOnlyGitHubJson(url, {
    token,
    fetchImpl,
    fallbackResource: 'core',
    now: isoFromMs(nowMs(options)),
    errorMessage: 'GitHub issue comments failed'
  });

  const summary = summarizeIssueComments(items);
  const cachedEntry = saveIssueCommentEnrichment(issue, summary, storage, {
    now: nowMs(options),
    tokenUsed: Boolean(String(token).trim())
  });

  return {
    summary,
    fromCache: false,
    cached: Boolean(cachedEntry),
    rateLimit
  };
}
