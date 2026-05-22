export const HIDDEN_STORAGE_KEY = 'pr_dashboard_hidden_v1';

function emptyHiddenItems() {
  return {
    version: 1,
    issues: {},
    repos: {}
  };
}

function getStorage(storage) {
  return storage || globalThis.localStorage || null;
}

function compactRecord(record) {
  if (!record || typeof record !== 'object') return {};
  return Object.fromEntries(Object.entries(record)
    .filter(([key, value]) => typeof key === 'string' && key && Number.isFinite(Number(value)))
    .map(([key, value]) => [key, Number(value)]));
}

function compactHiddenItems(hidden) {
  return {
    version: 1,
    issues: compactRecord(hidden?.issues),
    repos: compactRecord(hidden?.repos)
  };
}

function repoFromUrl(value) {
  try {
    const url = new URL(value || '');
    const segments = url.pathname.split('/').filter(Boolean);
    if (url.hostname === 'github.com' && segments.length >= 2) {
      return `${segments[0]}/${segments[1]}`.toLowerCase();
    }
    if (url.hostname === 'api.github.com' && segments.length >= 3 && segments[0] === 'repos') {
      return `${segments[1]}/${segments[2]}`.toLowerCase();
    }
  } catch {
    return null;
  }
  return null;
}

function issueNumberFromUrl(value) {
  try {
    const url = new URL(value || '');
    const segments = url.pathname.split('/').filter(Boolean);
    const issueIndex = segments.indexOf('issues');
    if (url.hostname === 'github.com' && issueIndex !== -1 && segments[issueIndex + 1]) {
      const number = Number.parseInt(segments[issueIndex + 1], 10);
      return Number.isFinite(number) && number > 0 ? number : null;
    }
  } catch {
    return null;
  }
  return null;
}

function issueUrlFromKey(key) {
  const match = String(key || '').match(/^([^/\s#]+)\/([^#\s]+)#([1-9]\d*)$/);
  if (!match) return null;
  return `https://github.com/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}/issues/${match[3]}`;
}

function repoUrlFromKey(key) {
  const match = String(key || '').match(/^([^/\s#]+)\/([^#\s]+)$/);
  if (!match) return null;
  return `https://github.com/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`;
}

function hiddenRows(record, urlBuilder) {
  return Object.entries(record || {})
    .map(([key, hiddenAt]) => ({
      key,
      hiddenAt,
      url: urlBuilder(key)
    }))
    .sort((a, b) => b.hiddenAt - a.hiddenAt || a.key.localeCompare(b.key));
}

export function loadHiddenItems(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return emptyHiddenItems();

  try {
    const raw = targetStorage.getItem(HIDDEN_STORAGE_KEY);
    if (!raw) return emptyHiddenItems();
    return compactHiddenItems(JSON.parse(raw));
  } catch {
    return emptyHiddenItems();
  }
}

export function saveHiddenItems(storage = getStorage(), hidden = emptyHiddenItems()) {
  const targetStorage = getStorage(storage);
  const compact = compactHiddenItems(hidden);
  if (targetStorage) {
    targetStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(compact));
  }
  return compact;
}

export function getRepoHideKey(issue) {
  const fullName = issue?.repository?.full_name || issue?.repository?.nameWithOwner;
  if (fullName && String(fullName).includes('/')) {
    return String(fullName).toLowerCase();
  }
  return repoFromUrl(issue?.html_url) || repoFromUrl(issue?.repository_url);
}

export function getIssueHideKey(issue) {
  const repoKey = getRepoHideKey(issue);
  const number = Number.parseInt(issue?.number, 10) || issueNumberFromUrl(issue?.html_url);
  if (!repoKey || !Number.isFinite(number) || number <= 0) return null;
  return `${repoKey}#${number}`;
}

export function isIssueHidden(issue, storage = getStorage()) {
  const key = getIssueHideKey(issue);
  if (!key) return false;
  return Boolean(loadHiddenItems(storage).issues[key]);
}

export function isRepoHidden(issue, storage = getStorage()) {
  const key = getRepoHideKey(issue);
  if (!key) return false;
  return Boolean(loadHiddenItems(storage).repos[key]);
}

export function hideIssue(issue, storage = getStorage()) {
  const key = getIssueHideKey(issue);
  const hidden = loadHiddenItems(storage);
  if (key) {
    hidden.issues[key] = Date.now();
    return saveHiddenItems(storage, hidden);
  }
  return hidden;
}

export function hideRepo(issue, storage = getStorage()) {
  const key = getRepoHideKey(issue);
  const hidden = loadHiddenItems(storage);
  if (key) {
    hidden.repos[key] = Date.now();
    return saveHiddenItems(storage, hidden);
  }
  return hidden;
}

export function clearHiddenItems(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (targetStorage) {
    targetStorage.removeItem(HIDDEN_STORAGE_KEY);
  }
}

export function listHiddenItems(storage = getStorage()) {
  const hidden = loadHiddenItems(storage);
  return {
    issues: hiddenRows(hidden.issues, issueUrlFromKey),
    repos: hiddenRows(hidden.repos, repoUrlFromKey)
  };
}

export function unhideIssueKey(key, storage = getStorage()) {
  const hidden = loadHiddenItems(storage);
  delete hidden.issues[String(key || '')];
  return saveHiddenItems(storage, hidden);
}

export function unhideRepoKey(key, storage = getStorage()) {
  const hidden = loadHiddenItems(storage);
  delete hidden.repos[String(key || '')];
  return saveHiddenItems(storage, hidden);
}

export function unhideHiddenItem(type, key, storage = getStorage()) {
  if (type === 'issue') return unhideIssueKey(key, storage);
  if (type === 'repo') return unhideRepoKey(key, storage);
  return loadHiddenItems(storage);
}

export function filterHiddenIssues(issues, storage = getStorage()) {
  const hidden = loadHiddenItems(storage);
  return (issues || []).filter(issue => {
    const issueKey = getIssueHideKey(issue);
    const repoKey = getRepoHideKey(issue);
    return !(issueKey && hidden.issues[issueKey]) && !(repoKey && hidden.repos[repoKey]);
  });
}
