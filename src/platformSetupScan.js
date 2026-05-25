import { hasAllTargetPlatformsSelected } from './platformFilters.js';

export const DEFAULT_PLATFORM_SETUP_SCAN_LIMIT = 8;

export function shouldScanPlatformSetup(filters = {}) {
  return !hasAllTargetPlatformsSelected(filters.targetPlatforms);
}

export function getPlatformSetupScanCandidates(items = [], filters = {}, options = {}) {
  if (!shouldScanPlatformSetup(filters)) return [];

  const parsedLimit = Number.parseInt(options.limit, 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(0, parsedLimit)
    : DEFAULT_PLATFORM_SETUP_SCAN_LIMIT;
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
