import {
  cleanReason,
  getCachedIssueEnrichmentEntry,
  getStorage,
  isoFromMs,
  nowMs,
  readScoreEnrichmentCache,
  saveIssueEnrichmentEntry
} from './enrichmentCache.js';
import { createReadOnlyGitHubRequestOptions, rateLimitFromReadOnlyResponse } from './githubReadOnly.js';
import { getCanonicalIssueKey, getRepoDisplayName } from '../issueKeys.js';
import { TARGET_PLATFORM_KEYS, TARGET_PLATFORM_OPTIONS } from '../platformFilters.js';

const REPO_SETUP_CACHE_TYPE = 'repo-setup';
const CONFIG_FILE_PATHS = new Set(['package.json', 'pyproject.toml', 'pom.xml']);

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
  const platformSupport = normalizePlatformFlags(summary.platformSupport);
  const platformUnsupported = normalizePlatformFlags(summary.platformUnsupported);
  return {
    inspected: Boolean(summary.inspected),
    filesChecked: Math.max(0, Number.parseInt(summary.filesChecked, 10) || 0),
    setupDocsPresent: Boolean(summary.setupDocsPresent),
    contributingPresent: Boolean(summary.contributingPresent),
    workflowPresent: Boolean(summary.workflowPresent),
    configHintsPresent: Boolean(summary.configHintsPresent),
    testHintsPresent: Boolean(summary.testHintsPresent),
    setupUnclear: Boolean(summary.setupUnclear),
    platformSupport,
    platformUnsupported,
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

function pathBasename(path) {
  const segments = String(path || '').split('/').filter(Boolean);
  return segments[segments.length - 1] || '';
}

function lowerPath(path) {
  return String(path || '').toLowerCase();
}

function normalizePlatformFlags(value) {
  const source = value && typeof value === 'object' ? value : {};
  return TARGET_PLATFORM_KEYS.reduce((flags, key) => {
    flags[key] = Boolean(source[key]);
    return flags;
  }, {});
}

function includesPattern(text, pattern) {
  return pattern.test(text);
}

function markOnlyPlatform(support, unsupported, platform) {
  support[platform] = true;
  TARGET_PLATFORM_KEYS.forEach(key => {
    if (key !== platform) unsupported[key] = true;
  });
}

function detectPlatformCompatibility(text) {
  const platformSupport = normalizePlatformFlags();
  const platformUnsupported = normalizePlatformFlags();
  const reasons = [];
  const source = String(text || '').toLowerCase();
  const displayLabels = Object.fromEntries(TARGET_PLATFORM_OPTIONS.map(item => [item.key, item.label]));

  const supportPatterns = {
    ios: [/\bios\b/, /\biphone\b/, /\bipad\b/],
    android: [/\bandroid\b/],
    macos: [/\bmacos\b/, /\bmac os\b/, /\bos x\b/, /\bdarwin\b/],
    linux: [
      /\blinux\b/,
      /\bdebian\b/,
      /\bfedora\b/,
      /\b(?:supported platforms?|supported os|supported operating systems?)(?:\s+(?:include|are))?\s*[:=-]?\s*[^.\n;]{0,80}\bubuntu\b(?!-latest)/,
      /\b(?:supports?|compatible with|works on)\s+[^.\n;]{0,80}\bubuntu\b(?!-latest)/,
      /\bubuntu\b(?!-latest) (?:is )?supported\b/
    ],
    windows: [/\bwindows\b/, /\bwin32\b/, /\bpowershell\b/],
    web: [
      /\bweb (?:app|application|client|frontend|front-end|ui)\b/,
      /\bfrontend (?:app|application|client|ui)\b/,
      /\bfront-end (?:app|application|client|ui)\b/,
      /\bclient-side (?:app|application|ui)\b/,
      /\bbrowser[- ]based\b/,
      /\b(?:runs?|opens?|loads?|served) (?:in|on) (?:the )?browser\b/
    ]
  };
  const unsupportedPatterns = {
    ios: [/\bios (?:is )?not supported\b/, /\bdoes not support ios\b/, /\bno ios support\b/],
    android: [/\bandroid (?:is )?not supported\b/, /\bdoes not support android\b/, /\bno android support\b/],
    macos: [/\bmacos (?:is )?not supported\b/, /\bmac os (?:is )?not supported\b/, /\bdoes not support macos\b/, /\bno macos support\b/],
    linux: [
      /\blinux (?:is )?not supported\b/,
      /\bdoes not support linux\b/,
      /\bno linux support\b/,
      /\bubuntu\b(?!-latest) (?:is )?not supported\b/,
      /\bdoes not support ubuntu\b/,
      /\bno ubuntu support\b/,
      /\bunsupported platforms?\s*[:=-]?\s*[^.\n;]{0,80}\bubuntu\b(?!-latest)/
    ],
    windows: [/\bwindows (?:is )?not supported\b/, /\bdoes not support windows\b/, /\bno windows support\b/, /\bwsl required\b/, /\brequires wsl\b/],
    web: [/\bweb (?:is )?not supported\b/, /\bdoes not support web\b/, /\bno web support\b/]
  };
  const onlyPatterns = {
    ios: [/\bios only\b/, /\bonly (?:supports? )?ios\b/],
    android: [/\bandroid only\b/, /\bonly (?:supports? )?android\b/],
    macos: [/\bmacos only\b/, /\bmac os only\b/, /\bonly (?:supports? )?macos\b/],
    linux: [/\blinux only\b/, /\bubuntu required\b/, /\brequires ubuntu\b/, /\bonly (?:supports? )?linux\b/],
    windows: [/\bwindows only\b/, /\bonly (?:supports? )?windows\b/],
    web: [/\bweb only\b/, /\bbrowser only\b/, /\bonly (?:supports? )?web\b/]
  };

  TARGET_PLATFORM_KEYS.forEach(key => {
    if (supportPatterns[key].some(pattern => includesPattern(source, pattern))) {
      platformSupport[key] = true;
    }
    if (unsupportedPatterns[key].some(pattern => includesPattern(source, pattern))) {
      platformUnsupported[key] = true;
    }
    if (onlyPatterns[key].some(pattern => includesPattern(source, pattern))) {
      markOnlyPlatform(platformSupport, platformUnsupported, key);
    }
  });

  if (/\bwsl\b/.test(source) || /\b(?:use|using|requires?|run(?:s)? on|tested on)\s+ubuntu\b|\bubuntu\s+required\b/.test(source)) {
    platformSupport.linux = true;
  }

  TARGET_PLATFORM_KEYS.forEach(key => {
    if (platformUnsupported[key]) platformSupport[key] = false;
    if (platformSupport[key]) reasons.push(`${displayLabels[key]} setup supported`);
    if (platformUnsupported[key]) reasons.push(`${displayLabels[key]} setup unsupported`);
  });

  return {
    platformSupport,
    platformUnsupported,
    reasons
  };
}

function isReadmePath(path) {
  return /^readme(?:\.|$)/i.test(pathBasename(path));
}

function isContributingPath(path) {
  return /^contributing(?:\.|$)/i.test(pathBasename(path));
}

function normalizeContentsList(data) {
  return Array.isArray(data) ? data.filter(item => item && typeof item === 'object') : [];
}

function findListedEntry(items, name, type) {
  const expectedName = String(name || '').toLowerCase();
  return items.find(item => {
    const itemName = String(item.name || pathBasename(item.path)).toLowerCase();
    return itemName === expectedName && (!type || item.type === type);
  }) || null;
}

function firstListedFile(items, predicate) {
  return items.find(item => item.type === 'file' && predicate(item.path || item.name)) || null;
}

function createDiscoveredItem(item, fallbackPath) {
  return {
    path: item?.path || fallbackPath,
    ok: true,
    data: item || { type: 'file', path: fallbackPath }
  };
}

function summarizeFetchedItems(items = []) {
  const successful = items.filter(item => item && item.ok);
  const found = new Map(successful.map(item => [lowerPath(item.path), item.data]));
  const workflows = found.get('.github/workflows');
  const packageJson = found.get('package.json');
  const pyproject = found.get('pyproject.toml');
  const pom = found.get('pom.xml');
  const packageText = decodeContent(packageJson);
  const pyprojectText = decodeContent(pyproject);
  const pomText = decodeContent(pom);
  const configText = [packageText, pyprojectText, pomText].join('\n').toLowerCase();
  const setupText = successful
    .filter(item => isReadmePath(item.path) || isContributingPath(item.path))
    .map(item => decodeContent(item.data))
    .join('\n');
  const platformCompatibility = detectPlatformCompatibility(setupText);

  const setupDocsPresent = successful.some(item => isReadmePath(item.path));
  const contributingPresent = successful.some(item => isContributingPath(item.path));
  const workflowPresent = Array.isArray(workflows)
    ? workflows.some(item => item?.type === 'file')
    : Boolean(workflows);
  const configHintsPresent = successful.some(item => CONFIG_FILE_PATHS.has(lowerPath(item.path)));
  const testHintsPresent = /\b(test|vitest|jest|pytest|mvn test|gradle test)\b/.test(configText)
    || /"test"\s*:/.test(packageText);
  const setupUnclear = !setupDocsPresent && !contributingPresent && !workflowPresent && !configHintsPresent;

  const reasons = [];
  if (setupDocsPresent) reasons.push('Setup docs found');
  if (contributingPresent) reasons.push('Contributing guide found');
  if (workflowPresent) reasons.push('CI workflow found');
  if (testHintsPresent || configHintsPresent) reasons.push('Test/build hints found');
  reasons.push(...platformCompatibility.reasons);
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
    platformSupport: platformCompatibility.platformSupport,
    platformUnsupported: platformCompatibility.platformUnsupported,
    reasons
  });
}

export function buildRepoContentsApiUrl(issue, repoPath) {
  const parts = repoParts(issue);
  if (!parts || !hasSafeGitHubIssueUrl(issue)) {
    throw new Error('Cannot inspect repo setup without a valid GitHub issue reference.');
  }
  const normalizedPath = String(repoPath || '').split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/');
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(parts.owner)}/${encodeURIComponent(parts.repo)}/contents`;
  return normalizedPath ? `${baseUrl}/${normalizedPath}` : baseUrl;
}

export function saveRepoSetupEnrichment(issue, summary, storage = getStorage(), options = {}) {
  return saveIssueEnrichmentEntry(issue, REPO_SETUP_CACHE_TYPE, normalizeRepoSetupSummary(summary), storage, options);
}

export function getCachedRepoSetupEnrichment(issue, storage = getStorage(), options = {}) {
  const entry = getCachedIssueEnrichmentEntry(issue, REPO_SETUP_CACHE_TYPE, storage, options);
  return entry ? { ...entry, summary: normalizeRepoSetupSummary(entry.summary) } : null;
}

export function createCachedRepoSetupEnrichmentResolver(storage = getStorage(), options = {}) {
  const cache = readScoreEnrichmentCache(storage);
  const now = nowMs(options);
  return issue => {
    const key = getCanonicalIssueKey(issue);
    if (!key) return null;
    const entry = cache.entries[`${key}|${REPO_SETUP_CACHE_TYPE}`];
    if (!entry || entry.type !== REPO_SETUP_CACHE_TYPE) return null;
    if (Date.parse(entry.expires_at) <= now) return null;
    return { ...entry, summary: normalizeRepoSetupSummary(entry.summary) };
  };
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

  async function fetchContents(repoPath, { optional = false } = {}) {
    const url = buildRepoContentsApiUrl(issue, repoPath);
    const response = await fetchImpl(url, createReadOnlyGitHubRequestOptions(url, token));
    lastRateLimit = rateLimitFromReadOnlyResponse(response, 'core', { now: isoFromMs(nowMs(options)) });
    if (response.status === 404) {
      if (optional) return null;
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'GitHub repository contents not found.');
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub repo setup failed with status code ${response.status}`);
    }
    return response.json();
  }

  const rootItems = normalizeContentsList(await fetchContents(''));
  const readme = firstListedFile(rootItems, isReadmePath);
  const contributing = firstListedFile(rootItems, isContributingPath);
  const configFiles = rootItems.filter(item => item.type === 'file' && CONFIG_FILE_PATHS.has(lowerPath(item.path || item.name)));
  const githubDir = findListedEntry(rootItems, '.github', 'dir');
  const docsDir = findListedEntry(rootItems, 'docs', 'dir');

  if (readme) {
    const data = await fetchContents(readme.path || readme.name || 'README.md', { optional: true });
    fetched.push(createDiscoveredItem(data || readme, readme.path || 'README.md'));
  }
  if (contributing) {
    const data = await fetchContents(contributing.path || contributing.name || 'CONTRIBUTING.md', { optional: true });
    fetched.push(createDiscoveredItem(data || contributing, contributing.path || 'CONTRIBUTING.md'));
  }

  for (const item of configFiles) {
    const data = await fetchContents(item.path || item.name, { optional: true });
    if (data) fetched.push({ path: item.path || item.name, ok: true, data });
  }

  if (githubDir) {
    const githubItems = normalizeContentsList(await fetchContents(githubDir.path || '.github', { optional: true }));
    const workflowsDir = findListedEntry(githubItems, 'workflows', 'dir');
    if (workflowsDir) {
      const workflows = await fetchContents(workflowsDir.path || '.github/workflows', { optional: true });
      if (workflows) fetched.push({ path: workflowsDir.path || '.github/workflows', ok: true, data: workflows });
    }
  }

  if (docsDir) {
    const docsItems = normalizeContentsList(await fetchContents(docsDir.path || 'docs', { optional: true }));
    const docsContributing = firstListedFile(docsItems, isContributingPath);
    if (docsContributing) {
      const data = await fetchContents(docsContributing.path || 'docs/CONTRIBUTING.md', { optional: true });
      fetched.push(createDiscoveredItem(data || docsContributing, docsContributing.path || 'docs/CONTRIBUTING.md'));
    }
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
