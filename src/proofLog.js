import { getCanonicalIssueKey, getIssueDisplayKey, getIssueType, getRepoDisplayName } from './issueKeys.js';

export const PROOF_LOG_STORAGE_KEY = 'pr_dashboard_proof_log_v1';

function emptyProofLog() {
  return {
    version: 1,
    entries: {}
  };
}

function getStorage(storage) {
  return storage || globalThis.localStorage || null;
}

function nowIso(options = {}) {
  return options.now || new Date().toISOString();
}

function compactEntry(entry) {
  const key = String(entry?.key || '').toLowerCase();
  if (!key) return null;
  const timestamp = entry.updated_at || entry.last_seen_at || entry.created_at || entry.completed_at || new Date().toISOString();
  return {
    key,
    type: entry.type === 'pull' ? 'pull' : 'issue',
    status: entry.status || 'marked_complete',
    source: entry.source || 'manual_lookup',
    issue_url: entry.issue_url || '',
    pr_url: entry.pr_url || '',
    proof_url: entry.proof_url || entry.pr_url || entry.issue_url || '',
    completed_at: entry.completed_at || timestamp,
    created_at: entry.created_at || timestamp,
    updated_at: entry.updated_at || timestamp,
    last_seen_at: entry.last_seen_at || timestamp,
    note: entry.note || '',
    snapshot: {
      title: String(entry.snapshot?.title || ''),
      repo: String(entry.snapshot?.repo || ''),
      display_key: String(entry.snapshot?.display_key || ''),
      number: Number.parseInt(entry.snapshot?.number, 10) || null,
      checklist: Array.isArray(entry.snapshot?.checklist) ? entry.snapshot.checklist : [],
      progress: Number.parseInt(entry.snapshot?.progress, 10) || 0,
      board_column: entry.snapshot?.board_column || ''
    }
  };
}

function compactProofLog(raw) {
  const log = emptyProofLog();
  const entries = raw?.entries && typeof raw.entries === 'object' ? raw.entries : {};
  for (const entry of Object.values(entries)) {
    const compact = compactEntry(entry);
    if (compact) log.entries[compact.key] = compact;
  }
  return log;
}

export function loadProofLog(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return emptyProofLog();

  try {
    const raw = targetStorage.getItem(PROOF_LOG_STORAGE_KEY);
    if (!raw) return emptyProofLog();
    return compactProofLog(JSON.parse(raw));
  } catch {
    targetStorage.removeItem(PROOF_LOG_STORAGE_KEY);
    return emptyProofLog();
  }
}

export function saveProofLog(log, storage = getStorage()) {
  const targetStorage = getStorage(storage);
  const compact = compactProofLog(log);
  if (targetStorage) {
    targetStorage.setItem(PROOF_LOG_STORAGE_KEY, JSON.stringify(compact));
  }
  return compact;
}

export function createProofEntryFromIssue(issue, options = {}) {
  const key = getCanonicalIssueKey(issue);
  if (!key) return null;
  const timestamp = nowIso(options);
  const type = options.type || getIssueType(issue);
  const url = issue?.html_url || '';
  const isPull = type === 'pull';
  const completedAt = options.completedAt || issue?.completed_at || issue?.merged_at || timestamp;

  return compactEntry({
    key,
    type,
    status: 'marked_complete',
    source: options.source || 'manual_lookup',
    issue_url: isPull ? '' : url,
    pr_url: isPull ? url : '',
    proof_url: url,
    completed_at: completedAt,
    created_at: timestamp,
    updated_at: timestamp,
    last_seen_at: timestamp,
    note: options.note || '',
    snapshot: {
      title: issue?.title || '',
      repo: getRepoDisplayName(issue) || '',
      display_key: getIssueDisplayKey(issue) || key,
      number: Number.parseInt(issue?.number, 10) || null,
      checklist: Array.isArray(issue?.checklist) ? issue.checklist : [],
      progress: Number.parseInt(issue?.progress, 10) || 0,
      board_column: options.boardColumn || ''
    }
  });
}

export function upsertProofEntry(entry, storage = getStorage(), options = {}) {
  const compact = compactEntry(entry);
  if (!compact) return null;
  const log = loadProofLog(storage);
  const existing = log.entries[compact.key];
  const timestamp = nowIso(options);
  log.entries[compact.key] = existing
    ? {
        ...existing,
        ...compact,
        completed_at: existing.completed_at,
        created_at: existing.created_at,
        updated_at: compact.updated_at || timestamp,
        last_seen_at: compact.last_seen_at || timestamp,
        note: compact.note || existing.note
      }
    : compact;
  saveProofLog(log, storage);
  return log.entries[compact.key];
}

export function listProofEntries(storage = getStorage()) {
  return Object.values(loadProofLog(storage).entries)
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)) || a.key.localeCompare(b.key));
}

export function removeProofEntry(key, storage = getStorage()) {
  const log = loadProofLog(storage);
  delete log.entries[String(key || '').toLowerCase()];
  return saveProofLog(log, storage);
}

export function clearProofLog(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (targetStorage) targetStorage.removeItem(PROOF_LOG_STORAGE_KEY);
}

export function backfillProofLogFromBoard(boardCards = {}, storage = getStorage(), options = {}) {
  const cards = Array.isArray(boardCards.Merged) ? boardCards.Merged : [];
  for (const card of cards) {
    const entry = createProofEntryFromIssue(card, {
      source: 'startup_backfill',
      boardColumn: 'Merged',
      completedAt: card.completed_at || card.column_entered_at || card.last_moved_at || card.saved_at,
      now: nowIso(options)
    });
    if (entry) upsertProofEntry(entry, storage, options);
  }
}
