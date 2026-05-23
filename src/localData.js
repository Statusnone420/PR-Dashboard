import { BOARD_COLUMNS, BOARD_STORAGE_KEY, createEmptyBoard, normalizeBoardCards } from './boardModel.js';
import { HIDDEN_STORAGE_KEY, loadHiddenItems, saveHiddenItems } from './hiddenItems.js';
import { getCanonicalIssueKey } from './issueKeys.js';
import { loadProfile, PROFILE_STORAGE_KEY, saveProfile } from './profile.js';
import {
  CONTRIBUTION_PREFERENCES_STORAGE_KEY,
  loadContributionPreferences,
  mergeContributionPreferences,
  saveContributionPreferences
} from './contributionPreferences.js';
import {
  MATCH_FEEDBACK_STORAGE_KEY,
  loadMatchFeedback,
  mergeMatchFeedback,
  saveMatchFeedback
} from './matchFeedback.js';
import { SCORE_ENRICHMENT_CACHE_KEY } from './api/issueComments.js';
import { loadProofLog, mergeProofLogs, PROOF_LOG_STORAGE_KEY, saveProofLog } from './proofLog.js';
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

function timestampValue(value) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
}

function compactHiddenRecord(record) {
  if (!record || typeof record !== 'object') return {};
  return Object.fromEntries(Object.entries(record)
    .filter(([key, value]) => typeof key === 'string' && key && Number.isFinite(Number(value)))
    .map(([key, value]) => [key, Number(value)]));
}

function mergeHiddenRecord(currentRecord, importedRecord) {
  const merged = { ...compactHiddenRecord(currentRecord) };
  for (const [key, timestamp] of Object.entries(compactHiddenRecord(importedRecord))) {
    merged[key] = Math.max(merged[key] || 0, timestamp);
  }
  return merged;
}

function mergeHiddenItems(currentHidden, importedHidden) {
  return {
    version: 1,
    issues: mergeHiddenRecord(currentHidden?.issues, importedHidden?.issues),
    repos: mergeHiddenRecord(currentHidden?.repos, importedHidden?.repos)
  };
}

function mergeProfile(currentProfile, importedProfile) {
  if (!currentProfile) return importedProfile || null;
  if (!importedProfile) return currentProfile;
  return timestampValue(importedProfile.saved_at) > timestampValue(currentProfile.saved_at)
    ? importedProfile
    : currentProfile;
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
    profile: targetStorage ? loadProfile(targetStorage) : null,
    contributionPreferences: targetStorage ? loadContributionPreferences(targetStorage) : null,
    matchFeedback: targetStorage ? loadMatchFeedback(targetStorage) : null
  };
}

export function importLocalData(storage = getStorage(), payload = {}) {
  const targetStorage = getStorage(storage);
  if (!targetStorage || payload?.version !== 1) {
    return { imported: false };
  }

  const boardCards = mergeBoardCards(parseBoard(targetStorage), payload.boardCards || {});
  targetStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(boardCards));

  const hiddenItems = payload.hiddenItems
    ? saveHiddenItems(targetStorage, mergeHiddenItems(loadHiddenItems(targetStorage), payload.hiddenItems))
    : loadHiddenItems(targetStorage);
  const proofLog = payload.proofLog
    ? saveProofLog(mergeProofLogs(loadProofLog(targetStorage), payload.proofLog), targetStorage)
    : loadProofLog(targetStorage);
  const retainedProfile = mergeProfile(loadProfile(targetStorage), payload.profile);
  const profile = retainedProfile
    ? saveProfile(retainedProfile, targetStorage)
    : loadProfile(targetStorage);
  const retainedContributionPreferences = mergeContributionPreferences(
    loadContributionPreferences(targetStorage),
    payload.contributionPreferences
  );
  const contributionPreferences = retainedContributionPreferences
    ? saveContributionPreferences(retainedContributionPreferences, targetStorage)
    : loadContributionPreferences(targetStorage);
  const matchFeedback = payload.matchFeedback
    ? saveMatchFeedback(mergeMatchFeedback(loadMatchFeedback(targetStorage), payload.matchFeedback), targetStorage)
    : loadMatchFeedback(targetStorage);

  return { imported: true, boardCards, hiddenItems, proofLog, profile, contributionPreferences, matchFeedback };
}

export function clearAllAppDataKeys(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return;
  targetStorage.removeItem(PROOF_LOG_STORAGE_KEY);
  targetStorage.removeItem(PROFILE_STORAGE_KEY);
  targetStorage.removeItem(CONTRIBUTION_PREFERENCES_STORAGE_KEY);
  targetStorage.removeItem(MATCH_FEEDBACK_STORAGE_KEY);
  targetStorage.removeItem(SCORE_ENRICHMENT_CACHE_KEY);
  targetStorage.removeItem(HIDDEN_STORAGE_KEY);
  targetStorage.removeItem(REPO_METADATA_CACHE_KEY);
}
