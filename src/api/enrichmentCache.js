import { getCanonicalIssueKey } from '../issueKeys.js';

export const SCORE_ENRICHMENT_CACHE_KEY = 'pr_dashboard_score_enrichment_cache_v1';
export const ISSUE_ENRICHMENT_TTL_MS = 6 * 60 * 60 * 1000;

export function getStorage(storage) {
  return storage || globalThis.localStorage || null;
}

export function nowMs(options = {}) {
  const value = options.now ?? Date.now();
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function isoFromMs(value) {
  return new Date(value).toISOString();
}

export function cleanReason(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function createEmptyCache() {
  return {
    version: 1,
    entries: {}
  };
}

function getEntryKey(issue, type) {
  const key = getCanonicalIssueKey(issue);
  if (!key) return null;
  return type === 'issue-comments' ? key : `${key}|${type}`;
}

function canCacheIssue(issue, options = {}) {
  const repo = issue?.repository || {};
  const visibility = String(repo.visibility || '').toLowerCase();
  if (repo.private === true || visibility === 'private') return false;
  if (options.tokenUsed && repo.private !== false && visibility !== 'public') return false;
  return true;
}

function safeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const type = String(entry.type || '');
  if (!type) return null;
  return {
    type,
    fetched_at: String(entry.fetched_at || ''),
    expires_at: String(entry.expires_at || ''),
    summary: entry.summary && typeof entry.summary === 'object' ? entry.summary : {}
  };
}

export function readScoreEnrichmentCache(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return createEmptyCache();
  try {
    const parsed = JSON.parse(targetStorage.getItem(SCORE_ENRICHMENT_CACHE_KEY) || '{}');
    const entries = {};
    for (const [key, entry] of Object.entries(parsed?.entries || {})) {
      const safe = safeEntry(entry);
      if (safe) entries[key] = safe;
    }
    return { version: 1, entries };
  } catch {
    targetStorage.removeItem(SCORE_ENRICHMENT_CACHE_KEY);
    return createEmptyCache();
  }
}

export function writeScoreEnrichmentCache(cache, storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (targetStorage) {
    targetStorage.setItem(SCORE_ENRICHMENT_CACHE_KEY, JSON.stringify({
      version: 1,
      entries: cache.entries || {}
    }));
  }
}

export function saveIssueEnrichmentEntry(issue, type, summary, storage = getStorage(), options = {}) {
  if (!canCacheIssue(issue, options)) return null;
  const key = getEntryKey(issue, type);
  if (!key) return null;
  const now = nowMs(options);
  const cache = readScoreEnrichmentCache(storage);
  const entry = {
    type,
    fetched_at: isoFromMs(now),
    expires_at: isoFromMs(now + ISSUE_ENRICHMENT_TTL_MS),
    summary
  };
  cache.entries[key] = entry;
  writeScoreEnrichmentCache(cache, storage);
  return entry;
}

export function getCachedIssueEnrichmentEntry(issue, type, storage = getStorage(), options = {}) {
  const key = getEntryKey(issue, type);
  if (!key) return null;
  const cache = readScoreEnrichmentCache(storage);
  const entry = cache.entries[key];
  if (!entry || entry.type !== type) return null;
  if (Date.parse(entry.expires_at) <= nowMs(options)) {
    delete cache.entries[key];
    writeScoreEnrichmentCache(cache, storage);
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
