import {
  BOARD_COLUMNS,
  BOARD_MIGRATION_KEY,
  BOARD_STORAGE_KEY,
  createDefaultActionPlan,
  createEmptyBoard,
  loadBoardFromStorage
} from '../boardModel.js';
import { REPO_METADATA_CACHE_KEY } from '../api/repoMetadata.js';
import { clearScoreEnrichmentCache } from '../api/issueComments.js';
import {
  clearHiddenItems as clearHiddenItemsFromStorage,
  hideIssue as hideIssueInStorage,
  hideRepo as hideRepoInStorage,
  unhideHiddenItem as unhideHiddenItemFromStorage
} from '../hiddenItems.js';
import {
  backfillProofLogFromBoard,
  clearProofLog,
  createProofEntryFromIssue,
  removeProofEntry,
  upsertProofEntry
} from '../proofLog.js';
import { clearProfile, loadProfile, saveProfileFromGitHubUser } from '../profile.js';
import {
  clearContributionPreferences,
  loadContributionPreferences,
  saveContributionPreferences
} from '../contributionPreferences.js';
import {
  clearMatchFeedback as clearMatchFeedbackFromStorage,
  loadMatchFeedback,
  recordMatchFeedbackEvent as recordMatchFeedbackEventInStorage
} from '../matchFeedback.js';
import { getCanonicalIssueKey } from '../issueKeys.js';
import { TARGET_PLATFORM_KEYS, normalizeTargetPlatforms } from '../platformFilters.js';

export function createDefaultFilters() {
  return {
    languages: [],
    labels: ['good first issue', 'help wanted'],
    labelMode: 'OR',
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false,
    unassigned: false,
    useFiltersInLookup: false,
    targetPlatforms: [...TARGET_PLATFORM_KEYS]
  };
}

function cloneFilters(filters) {
  const cloned = JSON.parse(JSON.stringify(filters));
  cloned.targetPlatforms = normalizeTargetPlatforms(cloned.targetPlatforms);
  return cloned;
}

function createEmptyRateLimitBucket(resource) {
  return {
    resource,
    remaining: null,
    limit: null,
    used: null,
    reset: null,
    updatedAt: null
  };
}

function createDefaultRateLimits() {
  return {
    core: createEmptyRateLimitBucket('core'),
    search: createEmptyRateLimitBucket('search'),
    lastResource: null,
    status: 'idle',
    error: null,
    lastCheckedAt: null
  };
}

function normalizeRateLimitResource(resource, fallback = 'core') {
  const value = String(resource || '').toLowerCase();
  if (value === 'search') return 'search';
  if (value === 'core') return 'core';
  return fallback === 'search' ? 'search' : 'core';
}

function normalizeRateLimitNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeRateLimitBucket(rateLimit = {}, resourceOverride = null) {
  const resource = normalizeRateLimitResource(resourceOverride || rateLimit.resource);
  return {
    ...createEmptyRateLimitBucket(resource),
    ...rateLimit,
    resource,
    remaining: normalizeRateLimitNumber(rateLimit.remaining),
    limit: normalizeRateLimitNumber(rateLimit.limit),
    used: normalizeRateLimitNumber(rateLimit.used),
    reset: normalizeRateLimitNumber(rateLimit.reset),
    updatedAt: rateLimit.updatedAt || new Date().toISOString()
  };
}

export class AppStore {
  constructor() {
    // 1. Navigation State
    this.currentScreen = 'dashboard'; // 'dashboard' | 'find-issues' | 'board' | 'settings'

    // 2. Token Security State (Honest Storage)
    this.rememberToken = localStorage.getItem('pr_dashboard_remember_token') === 'true';
    this.githubToken = '';

    if (this.rememberToken) {
      this.githubToken = localStorage.getItem('pr_dashboard_token') || '';
    }

    // 3. Contribution Board State
    this.boardCards = loadBoardFromStorage(localStorage);
    this.boardRefreshStatus = '';
    backfillProofLogFromBoard(this.boardCards, localStorage);

    // 3b. Local Profile State
    this.profile = loadProfile(localStorage);
    this.contributionPreferences = loadContributionPreferences(localStorage);
    this.matchFeedback = loadMatchFeedback(localStorage);

    // 4. Find Issues Search Cache & Parameters
    this.searchQuery = '';
    this.searchLoading = false;
    this.searchError = null;
    this.searchResults = null; // cached search results
    this.rateLimit = {
      remaining: null,
      limit: null,
      used: null,
      reset: null,
      resource: null,
      updatedAt: null
    };
    this.rateLimits = createDefaultRateLimits();

    // Filter selections: filters are last applied; draftFilters drive controls and query preview.
    this.filters = createDefaultFilters();
    this.draftFilters = cloneFilters(this.filters);
    this.finderMode = 'find';
    this.lastSearchMode = 'find';
    this.lastAppliedQueryPreview = '';
    this.lookupRepoContext = '';

    // 5. Details Inspector Panel
    this.inspectedIssue = null; // currently opened issue detail

    // 6. Pub/Sub Listeners
    this.listeners = [];
  }

  // Pub/Sub Methods
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (e) {
        console.error("Store notification listener error.");
      }
    }
  }

  // Navigation Updates
  setScreen(screenId) {
    this.currentScreen = screenId;
    this.notify();
  }

  // Token Management (Honest and Secure)
  updateToken(token, remember) {
    this.githubToken = token.trim();
    this.rememberToken = remember;
    localStorage.setItem('pr_dashboard_remember_token', remember ? 'true' : 'false');
    
    if (remember) {
      localStorage.setItem('pr_dashboard_token', this.githubToken);
    } else {
      localStorage.removeItem('pr_dashboard_token');
    }
    this.resetRateLimits({ notify: false });
    clearScoreEnrichmentCache(localStorage);
    this.notify();
  }

  clearToken() {
    this.githubToken = '';
    this.rememberToken = false;
    localStorage.removeItem('pr_dashboard_remember_token');
    localStorage.removeItem('pr_dashboard_token');
    clearProfile(localStorage);
    clearScoreEnrichmentCache(localStorage);
    this.profile = null;
    this.resetRateLimits({ notify: false });
    this.notify();
  }

  clearBoard() {
    this.boardCards = createEmptyBoard();
    localStorage.removeItem(BOARD_STORAGE_KEY);
    localStorage.setItem(BOARD_MIGRATION_KEY, 'board-cleared-by-user');
    this.notify();
  }

  clearAllLocalData() {
    this.clearToken();
    this.boardCards = createEmptyBoard();
    localStorage.removeItem(BOARD_STORAGE_KEY);
    localStorage.removeItem(BOARD_MIGRATION_KEY);
    clearHiddenItemsFromStorage(localStorage);
    clearProofLog(localStorage);
    clearProfile(localStorage);
    clearContributionPreferences(localStorage);
    clearMatchFeedbackFromStorage(localStorage);
    clearScoreEnrichmentCache(localStorage);
    localStorage.removeItem(REPO_METADATA_CACHE_KEY);
    this.profile = null;
    this.contributionPreferences = null;
    this.matchFeedback = loadMatchFeedback(localStorage);
    this.notify();
  }

  hideIssue(issue) {
    hideIssueInStorage(issue, localStorage);
    this.recordMatchFeedback(issue, 'hiddenIssue', { notify: false });
    if (this.inspectedIssue && this.inspectedIssue.id === issue?.id) {
      this.inspectedIssue = null;
    }
    this.notify();
  }

  hideRepo(issue) {
    hideRepoInStorage(issue, localStorage);
    this.recordMatchFeedback(issue, 'hiddenRepo', { notify: false });
    this.inspectedIssue = null;
    this.notify();
  }

  clearHiddenItems() {
    clearHiddenItemsFromStorage(localStorage);
    this.notify();
  }

  addIssueToProofLog(issue, options = {}) {
    const entry = createProofEntryFromIssue(issue, options);
    if (!entry) return null;
    const saved = upsertProofEntry(entry, localStorage);
    if (options.notify !== false) {
      this.notify();
    }
    return saved;
  }

  removeProofLogEntry(key) {
    removeProofEntry(key, localStorage);
    this.notify();
  }

  removeIssueFromProofLog(issue) {
    const key = getCanonicalIssueKey(issue);
    if (key) {
      removeProofEntry(key, localStorage);
    }
  }

  updateProfileFromGitHubUser(user, options = {}) {
    this.profile = saveProfileFromGitHubUser(user, localStorage);
    if (options.notify !== false) {
      this.notify();
    }
    return this.profile;
  }

  updateContributionPreferences(preferences, options = {}) {
    this.contributionPreferences = saveContributionPreferences(preferences, localStorage, options);
    if (options.notify !== false) {
      this.notify();
    }
    return this.contributionPreferences;
  }

  clearContributionPreferences(options = {}) {
    clearContributionPreferences(localStorage);
    this.contributionPreferences = null;
    if (options.notify !== false) {
      this.notify();
    }
  }

  recordMatchFeedback(issue, action, options = {}) {
    this.matchFeedback = recordMatchFeedbackEventInStorage(issue, action, localStorage, options);
    if (options.notify !== false) {
      this.notify();
    }
    return this.matchFeedback;
  }

  clearMatchFeedback(options = {}) {
    clearMatchFeedbackFromStorage(localStorage);
    this.matchFeedback = loadMatchFeedback(localStorage);
    if (options.notify !== false) {
      this.notify();
    }
  }

  unhideHiddenItem(type, key) {
    unhideHiddenItemFromStorage(type, key, localStorage);
    this.notify();
  }

  syncPassedHiddenState(cardObj, sourceCol, targetCol) {
    if (targetCol === 'Passed') {
      hideIssueInStorage(cardObj, localStorage);
      return;
    }

    if (sourceCol === 'Passed') {
      const key = getCanonicalIssueKey(cardObj);
      if (key) {
        unhideHiddenItemFromStorage('issue', key, localStorage);
      }
    }
  }

  // Inspector Panel Action Plan Tasks Persistence
  toggleTaskChecklist(issueId, taskText, completed) {
    let card = null;
    for (const column of BOARD_COLUMNS) {
      card = (this.boardCards[column] || []).find(c => c.id === issueId);
      if (card) break;
    }

    if (card) {
      if (!card.checklist) card.checklist = [];
      const task = card.checklist.find(t => t.text === taskText);
      if (task) {
        task.completed = completed;
        const total = card.checklist.length;
        const done = card.checklist.filter(t => t.completed).length;
        card.progress = total > 0 ? Math.round((done / total) * 100) : 0;
        this.saveBoardToStorage();
      }
    }
    // Also update inspectedIssue if it matches
    if (this.inspectedIssue && this.inspectedIssue.id === issueId) {
      if (!this.inspectedIssue.checklist) this.inspectedIssue.checklist = [];
      const insTask = this.inspectedIssue.checklist.find(t => t.text === taskText);
      if (insTask) {
        insTask.completed = completed;
        const total = this.inspectedIssue.checklist.length;
        const done = this.inspectedIssue.checklist.filter(t => t.completed).length;
        this.inspectedIssue.progress = total > 0 ? Math.round((done / total) * 100) : 0;
      }
    }
    this.notify();
  }

  // Board CRUD and Actions
  saveBoardToStorage() {
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(this.boardCards));
  }

  saveIssueToBoard(issue) {
    // Check if issue already exists in any column
    const allCols = Object.keys(this.boardCards);
    let exists = false;
    for (const col of allCols) {
      if (this.boardCards[col].some(c => c.id === issue.id)) {
        exists = true;
        break;
      }
    }

    if (!exists) {
      // Add default checklist for new cards in board
      const timestamp = new Date().toISOString();
      const freshIssue = JSON.parse(JSON.stringify(issue));
      freshIssue.source = 'github';
      freshIssue.saved_at = timestamp;
      freshIssue.last_moved_at = timestamp;
      freshIssue.column_entered_at = timestamp;
      freshIssue.state = freshIssue.state || 'open';
      freshIssue.checklist = createDefaultActionPlan();
      freshIssue.progress = 0;
      freshIssue.commits = 0;
      
      if (!this.boardCards["Considering"]) this.boardCards["Considering"] = [];
      this.boardCards["Considering"].push(freshIssue);
      this.saveBoardToStorage();
      this.recordMatchFeedback(freshIssue, 'saved', { now: timestamp, notify: false });
    }
    this.notify();
  }

  moveBoardCard(cardId, direction) {
    // Columns list
    const cols = ['Considering', 'Read Docs', 'Asked Maintainer', 'Working', 'PR Open', 'Merged', 'Passed'];
    
    let sourceCol = null;
    let cardIndex = -1;
    let cardObj = null;

    for (const col of cols) {
      const idx = this.boardCards[col].findIndex(c => c.id === cardId);
      if (idx !== -1) {
        sourceCol = col;
        cardIndex = idx;
        cardObj = this.boardCards[col][idx];
        break;
      }
    }

    if (sourceCol) {
      const currentIdx = cols.indexOf(sourceCol);
      const targetIdx = currentIdx + direction;

      if (targetIdx >= 0 && targetIdx < cols.length) {
        const targetCol = cols[targetIdx];
        // Remove from source
        this.boardCards[sourceCol].splice(cardIndex, 1);
        // Add to target
        const timestamp = new Date().toISOString();
        cardObj.last_moved_at = timestamp;
        cardObj.column_entered_at = timestamp;
        this.boardCards[targetCol].push(cardObj);
        if (targetCol === 'Merged') {
          this.addIssueToProofLog(cardObj, {
            source: 'board_merged',
            boardColumn: 'Merged',
            completedAt: timestamp,
            now: timestamp,
            notify: false
          });
        } else if (targetCol === 'Passed') {
          this.removeIssueFromProofLog(cardObj);
        }
        this.syncPassedHiddenState(cardObj, sourceCol, targetCol);
        if (targetCol === 'Working' || targetCol === 'Merged' || targetCol === 'Passed') {
          this.recordMatchFeedback(cardObj, `entered:${targetCol}`, { now: timestamp, notify: false });
        }
        this.saveBoardToStorage();
        this.notify();
      }
    }
  }

  removeBoardCard(cardId) {
    const cols = Object.keys(this.boardCards);
    for (const col of cols) {
      this.boardCards[col] = this.boardCards[col].filter(c => c.id !== cardId);
    }
    this.saveBoardToStorage();
    this.notify();
  }

  updateBoardCard(cardId, updater) {
    const cols = Object.keys(this.boardCards);
    for (const col of cols) {
      const index = this.boardCards[col].findIndex(c => c.id === cardId);
      if (index !== -1) {
        this.boardCards[col][index] = updater(this.boardCards[col][index], col);
        this.saveBoardToStorage();
        this.notify();
        return this.boardCards[col][index];
      }
    }
    return null;
  }

  markGitHubActivityReviewed(cardId, now = new Date().toISOString()) {
    const updated = this.updateBoardCard(cardId, card => ({
      ...card,
      github_activity: {
        ...(card.github_activity || {}),
        acknowledged_at: now
      }
    }));
    if (updated && this.inspectedIssue?.id === cardId) {
      this.inspectedIssue = {
        ...this.inspectedIssue,
        github_activity: updated.github_activity
      };
    }
    return updated;
  }

  setBoardCards(boardCards) {
    this.boardCards = boardCards;
    this.saveBoardToStorage();
    this.notify();
  }

  setBoardRefreshStatus(status) {
    this.boardRefreshStatus = status;
    this.notify();
  }

  moveCardToColumn(cardId, targetCol) {
    if (!this.boardCards[targetCol]) return;

    let cardObj = null;
    let sourceCol = null;
    for (const col of Object.keys(this.boardCards)) {
      const index = this.boardCards[col].findIndex(c => c.id === cardId);
      if (index !== -1) {
        sourceCol = col;
        cardObj = this.boardCards[col].splice(index, 1)[0];
        break;
      }
    }

    if (cardObj) {
      const timestamp = new Date().toISOString();
      cardObj.last_moved_at = timestamp;
      cardObj.column_entered_at = timestamp;
      this.boardCards[targetCol].push(cardObj);
      if (targetCol === 'Merged') {
        this.addIssueToProofLog(cardObj, {
          source: 'board_merged',
          boardColumn: 'Merged',
          completedAt: timestamp,
          now: timestamp,
          notify: false
        });
      } else if (targetCol === 'Passed') {
        this.removeIssueFromProofLog(cardObj);
      }
      this.syncPassedHiddenState(cardObj, sourceCol, targetCol);
      if (targetCol === 'Working' || targetCol === 'Merged' || targetCol === 'Passed') {
        this.recordMatchFeedback(cardObj, `entered:${targetCol}`, { now: timestamp, notify: false });
      }
      this.saveBoardToStorage();
      this.notify();
    }
  }

  // Search Results & Filters
  setSearchQuery(query) {
    this.searchQuery = query;
  }

  setFilters(newFilters) {
    this.filters = { ...this.filters, ...newFilters };
    this.draftFilters = cloneFilters(this.filters);
    this.notify();
  }

  setDraftFilters(newFilters) {
    this.draftFilters = { ...this.draftFilters, ...newFilters };
    this.notify();
  }

  applyDraftFilters() {
    this.filters = cloneFilters(this.draftFilters);
    this.notify();
    return this.filters;
  }

  hasDraftFilterChanges() {
    return JSON.stringify(this.filters) !== JSON.stringify(this.draftFilters);
  }

  setFinderMode(mode) {
    this.finderMode = mode === 'lookup' ? 'lookup' : 'find';
    this.notify();
  }

  setLastSearchMetadata({ mode, queryPreview, lookupRepoContext } = {}) {
    if (mode) this.lastSearchMode = mode;
    if (queryPreview !== undefined) this.lastAppliedQueryPreview = queryPreview;
    if (lookupRepoContext !== undefined) this.lookupRepoContext = lookupRepoContext || '';
  }

  setSearchState(loading, error, results = null) {
    this.searchLoading = loading;
    this.searchError = error;
    if (results !== null) {
      this.searchResults = results;
    }
    this.notify();
  }

  resetRateLimits(options = {}) {
    this.rateLimit = {
      remaining: null,
      limit: null,
      used: null,
      reset: null,
      resource: null,
      updatedAt: null
    };
    this.rateLimits = createDefaultRateLimits();
    if (options.notify !== false) {
      this.notify();
    }
  }

  setRateLimit(rateLimit, resourceOverride = null, options = {}) {
    const bucket = normalizeRateLimitBucket(rateLimit, resourceOverride);
    const clearStaleError = this.rateLimits.status === 'error';
    const nextRateLimits = {
      ...this.rateLimits,
      [bucket.resource]: bucket,
      lastResource: bucket.resource,
      status: clearStaleError ? 'idle' : this.rateLimits.status,
      error: clearStaleError ? null : this.rateLimits.error
    };

    this.rateLimits = nextRateLimits;
    this.rateLimit = { ...bucket };
    if (options.notify !== false) {
      this.notify();
    }
  }

  setRateLimits(snapshot = {}, options = {}) {
    let lastResource = this.rateLimits.lastResource;
    const nextRateLimits = { ...this.rateLimits };

    for (const resource of ['core', 'search']) {
      if (snapshot[resource]) {
        const bucket = normalizeRateLimitBucket(snapshot[resource], resource);
        nextRateLimits[resource] = bucket;
        lastResource = resource;
      }
    }

    nextRateLimits.lastResource = snapshot.lastResource || lastResource;
    if (snapshot.status !== undefined) nextRateLimits.status = snapshot.status;
    if (snapshot.error !== undefined) nextRateLimits.error = snapshot.error;
    if (snapshot.lastCheckedAt !== undefined) nextRateLimits.lastCheckedAt = snapshot.lastCheckedAt;

    this.rateLimits = nextRateLimits;
    if (nextRateLimits.lastResource && nextRateLimits[nextRateLimits.lastResource]) {
      this.rateLimit = { ...nextRateLimits[nextRateLimits.lastResource] };
    }
    if (options.notify !== false) {
      this.notify();
    }
  }

  setRateLimitStatus(status, error = null, options = {}) {
    this.rateLimits = {
      ...this.rateLimits,
      status,
      error,
      lastCheckedAt: options.lastCheckedAt !== undefined
        ? options.lastCheckedAt
        : this.rateLimits.lastCheckedAt
    };
    this.notify();
  }

  // Inspector Drawer Actions
  setInspectedIssue(issue) {
    // If we're setting an inspected issue, check if it already exists on the board to carry over its local tasks & progress
    if (issue) {
      const cols = Object.keys(this.boardCards);
      let foundBoardCard = null;
      for (const col of cols) {
        const match = this.boardCards[col].find(c => c.id === issue.id);
        if (match) {
          foundBoardCard = match;
          break;
        }
      }
      if (foundBoardCard) {
        issue.checklist = foundBoardCard.checklist;
        issue.progress = foundBoardCard.progress;
        issue.commits = foundBoardCard.commits;
        issue.github_activity = foundBoardCard.github_activity;
        issue.last_refreshed_at = foundBoardCard.last_refreshed_at;
        issue.refresh_error = foundBoardCard.refresh_error;
      } else {
        // Default checklist for inspection
        issue.checklist = createDefaultActionPlan();
        issue.progress = 0;
        issue.commits = 0;
      }
    }
    this.inspectedIssue = issue;
    this.notify();
  }
}

export const store = new AppStore();
