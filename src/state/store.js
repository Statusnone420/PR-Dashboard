import {
  BOARD_MIGRATION_KEY,
  BOARD_STORAGE_KEY,
  createDefaultActionPlan,
  createEmptyBoard,
  loadBoardFromStorage
} from '../boardModel.js';
import {
  clearHiddenItems as clearHiddenItemsFromStorage,
  hideIssue as hideIssueInStorage,
  hideRepo as hideRepoInStorage,
  unhideHiddenItem as unhideHiddenItemFromStorage
} from '../hiddenItems.js';

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
    useFiltersInLookup: false
  };
}

function cloneFilters(filters) {
  return JSON.parse(JSON.stringify(filters));
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

    // 4. Find Issues Search Cache & Parameters
    this.searchQuery = '';
    this.searchLoading = false;
    this.searchError = null;
    this.searchResults = null; // cached search results
    this.rateLimit = {
      remaining: null,
      limit: null,
      reset: null
    };

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
    this.notify();
  }

  clearToken() {
    this.githubToken = '';
    this.rememberToken = false;
    localStorage.removeItem('pr_dashboard_remember_token');
    localStorage.removeItem('pr_dashboard_token');
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
    this.notify();
  }

  hideIssue(issue) {
    hideIssueInStorage(issue, localStorage);
    if (this.inspectedIssue && this.inspectedIssue.id === issue?.id) {
      this.inspectedIssue = null;
    }
    this.notify();
  }

  hideRepo(issue) {
    hideRepoInStorage(issue, localStorage);
    this.inspectedIssue = null;
    this.notify();
  }

  clearHiddenItems() {
    clearHiddenItemsFromStorage(localStorage);
    this.notify();
  }

  unhideHiddenItem(type, key) {
    unhideHiddenItemFromStorage(type, key, localStorage);
    this.notify();
  }

  // Inspector Panel Action Plan Tasks Persistence
  toggleTaskChecklist(issueId, taskText, completed) {
    // Check if the issue is in Working column
    const workingCards = this.boardCards["Working"] || [];
    const card = workingCards.find(c => c.id === issueId);
    if (card) {
      if (!card.checklist) card.checklist = [];
      const task = card.checklist.find(t => t.text === taskText);
      if (task) {
        task.completed = completed;
        // Calculate progress
        const total = card.checklist.length;
        const done = card.checklist.filter(t => t.completed).length;
        card.progress = Math.round((done / total) * 100);
      }
      this.saveBoardToStorage();
    }
    // Also update inspectedIssue if it matches
    if (this.inspectedIssue && this.inspectedIssue.id === issueId) {
      if (!this.inspectedIssue.checklist) this.inspectedIssue.checklist = [];
      const insTask = this.inspectedIssue.checklist.find(t => t.text === taskText);
      if (insTask) {
        insTask.completed = completed;
        const total = this.inspectedIssue.checklist.length;
        const done = this.inspectedIssue.checklist.filter(t => t.completed).length;
        this.inspectedIssue.progress = Math.round((done / total) * 100);
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
      const freshIssue = JSON.parse(JSON.stringify(issue));
      freshIssue.source = 'github';
      freshIssue.saved_at = new Date().toISOString();
      freshIssue.state = freshIssue.state || 'open';
      freshIssue.checklist = createDefaultActionPlan();
      freshIssue.progress = 0;
      freshIssue.commits = 0;
      
      if (!this.boardCards["Considering"]) this.boardCards["Considering"] = [];
      this.boardCards["Considering"].push(freshIssue);
      this.saveBoardToStorage();
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
        this.boardCards[targetCol].push(cardObj);
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
    for (const col of Object.keys(this.boardCards)) {
      const index = this.boardCards[col].findIndex(c => c.id === cardId);
      if (index !== -1) {
        cardObj = this.boardCards[col].splice(index, 1)[0];
        break;
      }
    }

    if (cardObj) {
      this.boardCards[targetCol].push(cardObj);
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

  setRateLimit(rateLimit) {
    this.rateLimit = { ...this.rateLimit, ...rateLimit };
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
