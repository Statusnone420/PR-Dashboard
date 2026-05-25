import { ISSUE_ENRICHMENT_TTL_MS, nowMs } from './api/enrichmentCache.js';

export const DEFAULT_PLATFORM_SETUP_SCAN_LIMIT = 30;
export const DEFAULT_PLATFORM_SETUP_SCAN_BUDGET = DEFAULT_PLATFORM_SETUP_SCAN_LIMIT;
export const DEFAULT_PLATFORM_SETUP_SCAN_CONCURRENCY = 4;

function normalizeScanLimit(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.max(0, parsed)
    : fallback;
}

export function shouldScanPlatformSetup() {
  return true;
}

export function getPlatformSetupScanCandidates(items = [], filters = {}, options = {}) {
  if (!shouldScanPlatformSetup(filters)) return [];

  const limit = normalizeScanLimit(options.limit, DEFAULT_PLATFORM_SETUP_SCAN_LIMIT);
  const hasCachedSetup = typeof options.hasCachedSetup === 'function' ? options.hasCachedSetup : () => false;
  const isAlreadyScanning = typeof options.isAlreadyScanning === 'function' ? options.isAlreadyScanning : () => false;
  const getKey = typeof options.getKey === 'function' ? options.getKey : issue => issue?.id || issue?.html_url || '';
  const candidates = [];
  const seen = new Set();

  for (const issue of items || []) {
    if (!issue || candidates.length >= limit) break;
    const key = String(getKey(issue) || '');
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    if (hasCachedSetup(issue) || isAlreadyScanning(issue)) continue;
    candidates.push(issue);
  }

  return candidates;
}

export function createPlatformSetupScanBudget(options = {}) {
  return {
    searchKey: '',
    reservedKeys: new Set(),
    limit: normalizeScanLimit(options.limit, DEFAULT_PLATFORM_SETUP_SCAN_BUDGET)
  };
}

export function resetPlatformSetupScanBudget(budget, searchKey = '') {
  if (!budget) return null;
  budget.searchKey = String(searchKey || '');
  budget.reservedKeys = new Set();
  return budget;
}

export function reservePlatformSetupScanBudget(budget, searchKey, candidates = [], options = {}) {
  if (!budget) return candidates || [];

  const normalizedSearchKey = String(searchKey || '');
  if (budget.searchKey !== normalizedSearchKey) {
    resetPlatformSetupScanBudget(budget, normalizedSearchKey);
  }

  const limit = normalizeScanLimit(options.limit, budget.limit);
  const getKey = typeof options.getKey === 'function' ? options.getKey : issue => issue?.id || issue?.html_url || '';
  const remaining = Math.max(0, limit - budget.reservedKeys.size);
  const reserved = [];

  if (remaining === 0) return reserved;

  for (const [index, issue] of (candidates || []).entries()) {
    if (reserved.length >= remaining) break;
    const key = String(getKey(issue) || `candidate:${index}`);
    if (budget.reservedKeys.has(key)) continue;
    budget.reservedKeys.add(key);
    reserved.push(issue);
  }

  return reserved;
}

export function recordPlatformSetupScanFailure(failures, key, scanRunId, activeRunId) {
  if (!failures || typeof failures.add !== 'function') return false;
  const normalizedKey = String(key || '');
  if (!normalizedKey || scanRunId !== activeRunId) return false;
  failures.add(normalizedKey);
  return true;
}

export function setPlatformSetupSessionSummary(results, key, summary, options = {}) {
  if (!results || typeof results.set !== 'function') return null;
  const normalizedKey = String(key || '');
  if (!normalizedKey || !summary) return null;
  const ttlMs = Number.isFinite(Number(options.ttlMs))
    ? Math.max(0, Number(options.ttlMs))
    : ISSUE_ENRICHMENT_TTL_MS;
  const entry = {
    summary,
    expiresAt: nowMs(options) + ttlMs
  };
  results.set(normalizedKey, entry);
  return entry;
}

export function getPlatformSetupSessionSummary(results, key, options = {}) {
  if (!results || typeof results.get !== 'function') return null;
  const normalizedKey = String(key || '');
  if (!normalizedKey) return null;
  const entry = results.get(normalizedKey);
  const expiresAt = Number(entry?.expiresAt);
  if (!entry?.summary || !Number.isFinite(expiresAt) || expiresAt <= nowMs(options)) {
    results.delete(normalizedKey);
    return null;
  }
  return entry.summary;
}
