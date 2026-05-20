import { mockBoardCards } from '../data/mockData.js';

class AppStore {
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
    const savedBoard = localStorage.getItem('pr_dashboard_board_cards');
    if (savedBoard) {
      try {
        this.boardCards = JSON.parse(savedBoard);
      } catch (e) {
        this.boardCards = JSON.parse(JSON.stringify(mockBoardCards));
      }
    } else {
      this.boardCards = JSON.parse(JSON.stringify(mockBoardCards));
    }

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

    // Filter selections
    this.filters = {
      languages: [], // e.g. ['TypeScript']
      labels: ['help wanted'], // default label selection
      labelMode: 'OR', // 'OR' | 'AND'
      stars: '1k+', // 'Any' | '1k+' | '5k+' | '10k+'
      comments: 'Any', // 'Any' | 'Low (0-5)' | 'Medium (6-15)' | 'High (15+)'
      updatedDate: 'Any', // 'Any' | 'Last 24h' | 'Last week' | 'Last month'
      sortMode: 'Fit Score' // 'Fit Score' | 'Updated Date' | 'Most Commented' | 'Recently Created'
    };

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
        console.error("Store notification listener error:", e);
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
    localStorage.setItem('pr_dashboard_board_cards', JSON.stringify(this.boardCards));
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
      freshIssue.checklist = [
        { text: "Read CONTRIBUTING.md", completed: false },
        { text: "Fork repository", completed: false },
        { text: "Setup local environment", completed: false },
        { text: "Draft PR for feedback", completed: false }
      ];
      freshIssue.progress = 0;
      freshIssue.commits = 0;
      
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

  // Search Results & Filters
  setSearchQuery(query) {
    this.searchQuery = query;
  }

  setFilters(newFilters) {
    this.filters = { ...this.filters, ...newFilters };
    this.notify();
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
        issue.checklist = [
          { text: "Read CONTRIBUTING.md", completed: false },
          { text: "Fork repository", completed: false },
          { text: "Setup local environment", completed: false },
          { text: "Draft PR for feedback", completed: false }
        ];
        issue.progress = 0;
        issue.commits = 0;
      }
    }
    this.inspectedIssue = issue;
    this.notify();
  }
}

export const store = new AppStore();
