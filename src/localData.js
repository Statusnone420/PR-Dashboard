import { BOARD_COLUMNS, BOARD_STORAGE_KEY, createEmptyBoard, normalizeBoardCards } from './boardModel.js';
import { HIDDEN_STORAGE_KEY, loadHiddenItems, saveHiddenItems } from './hiddenItems.js';
import { getCanonicalIssueKey } from './issueKeys.js';
import { loadProfile, PROFILE_STORAGE_KEY, saveProfile } from './profile.js';
import { loadProofLog, PROOF_LOG_STORAGE_KEY, saveProofLog } from './proofLog.js';
import { REPO_METADATA_CACHE_KEY } from './api/repoMetadata.js';

function getStorage(storage) {
  return storage || globalThis.localStorage || null;
}

function parseBoard(storage) {
  try {
    return JSON.parse(storage.getItem(BOARD_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function workflowTime(card) {
  return Date.parse(card?.column_entered_at || card?.last_moved_at || card?.saved_at || card?.updated_at || '') || 0;
}

function activityCheckedTime(activity) {
  const time = Date.parse(activity?.last_checked_at || '');
  return Number.isFinite(time) ? time : 0;
}

function validAcknowledgedAt(activity) {
  const acknowledged = Date.parse(activity?.acknowledged_at || '');
  const checked = Date.parse(activity?.last_checked_at || '');
  return Number.isFinite(acknowledged) && Number.isFinite(checked) && acknowledged >= checked;
}

function mergeGitHubActivity(leftCard, rightCard) {
  const leftActivity = leftCard?.github_activity;
  const rightActivity = rightCard?.github_activity;
  if (!leftActivity && !rightActivity) return undefined;

  const retained = activityCheckedTime(rightActivity) > activityCheckedTime(leftActivity)
    ? rightActivity
    : leftActivity || rightActivity;
  if (!retained) return undefined;

  const merged = { ...retained };
  if (!validAcknowledgedAt(merged)) {
    delete merged.acknowledged_at;
  }
  return merged;
}

function withMergedGitHubActivity(selectedCard, leftCard, rightCard) {
  const activity = mergeGitHubActivity(leftCard, rightCard);
  if (!activity) {
    const { github_activity: _activity, ...withoutActivity } = selectedCard;
    return withoutActivity;
  }
  return {
    ...selectedCard,
    github_activity: activity
  };
}

function mergeBoardCards(currentBoard, importedBoard) {
  const merged = createEmptyBoard();
  const entries = [];
  const canonicalIndex = new Map();
  const numericIdIndex = new Map();

  for (const source of [currentBoard, importedBoard]) {
    const normalized = normalizeBoardCards(source).board;
    for (const column of BOARD_COLUMNS) {
      for (const card of normalized[column] || []) {
        const canonical = getCanonicalIssueKey(card);
        const numericId = card?.id ? String(card.id) : null;
        if (!canonical && !numericId) continue;

        const existingIndex = canonicalIndex.has(canonical)
          ? canonicalIndex.get(canonical)
          : numericId && numericIdIndex.has(numericId)
            ? numericIdIndex.get(numericId)
            : -1;

        if (existingIndex === -1) {
          const nextIndex = entries.length;
          entries.push({ column, card });
          if (canonical) canonicalIndex.set(canonical, nextIndex);
          if (numericId) numericIdIndex.set(numericId, nextIndex);
          continue;
        }

        const previous = entries[existingIndex];
        const keepIncomingWorkflow = workflowTime(card) >= workflowTime(previous.card);
        const selected = keepIncomingWorkflow
          ? { column, card }
          : previous;
        entries[existingIndex] = {
          column: selected.column,
          card: withMergedGitHubActivity(selected.card, previous.card, card)
        };
        if (keepIncomingWorkflow) {
          if (canonical) canonicalIndex.set(canonical, existingIndex);
          if (numericId) numericIdIndex.set(numericId, existingIndex);
        }
      }
    }
  }

  for (const { column, card } of entries) {
    if (!merged[column]) merged[column] = [];
    merged[column].push(card);
  }

  return merged;
}

export function exportLocalData(storage = getStorage(), options = {}) {
  const targetStorage = getStorage(storage);
  return {
    version: 1,
    exported_at: options.now || new Date().toISOString(),
    boardCards: targetStorage ? normalizeBoardCards(parseBoard(targetStorage)).board : createEmptyBoard(),
    hiddenItems: targetStorage ? loadHiddenItems(targetStorage) : { version: 1, issues: {}, repos: {} },
    proofLog: targetStorage ? loadProofLog(targetStorage) : { version: 1, entries: {} },
    profile: targetStorage ? loadProfile(targetStorage) : null
  };
}

export function importLocalData(storage = getStorage(), payload = {}) {
  const targetStorage = getStorage(storage);
  if (!targetStorage || payload?.version !== 1) {
    return { imported: false };
  }

  const boardCards = mergeBoardCards(parseBoard(targetStorage), payload.boardCards || {});
  targetStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(boardCards));

  if (payload.hiddenItems) {
    saveHiddenItems(targetStorage, payload.hiddenItems);
  }
  if (payload.proofLog) {
    saveProofLog(payload.proofLog, targetStorage);
  }
  if (payload.profile) {
    saveProfile(payload.profile, targetStorage);
  }

  return { imported: true, boardCards };
}

export function clearAllAppDataKeys(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return;
  targetStorage.removeItem(PROOF_LOG_STORAGE_KEY);
  targetStorage.removeItem(PROFILE_STORAGE_KEY);
  targetStorage.removeItem(HIDDEN_STORAGE_KEY);
  targetStorage.removeItem(REPO_METADATA_CACHE_KEY);
}
