import { store } from './state/store.js';
import { buildQueryPreview, createGitHubRequestOptions, fetchExactIssue, fetchIssueMetadata, searchGitHubIssues } from './api/github.js';
import { screenFromHash } from './routing.js';
import { applyFilterPatch, applyPresetSearch, getRelaxedFilters } from './searchInteractions.js';
import { escapeHTML, formatDate, getSafeIssueHtmlUrl, safeInteger, safePercent } from './security.js';
import { BOARD_COLUMNS, isClosedIssue, mergeIssueMetadata } from './boardModel.js';
import { buildExactIssueApiUrl, parseExactLookupInput } from './lookup.js';
import { calculateMatchScore, getMatchScoreRating } from './matchScore.js';
import { getDashboardHeroRecommendation } from './dashboardHero.js';
import { buildContributionBrief } from './contributionBrief.js';
import { filterHiddenIssues, listHiddenItems } from './hiddenItems.js';

const HIDDEN_RESULTS_RENDER_LIMIT = 100;
let hiddenSettingsFilter = '';

// Initialize SPA
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupGlobalSearch();
  store.currentScreen = screenFromHash(window.location.hash);
  
  // Initial render
  renderActiveScreen();
  updateSidebarActiveState(store.currentScreen);

  // Subscribe UI to store changes
  store.subscribe((state) => {
    updateRateLimitBadge(state.rateLimit);
    renderActiveScreen();
    updateSidebarActiveState(state.currentScreen);
  });
});

/**
 * Calculates issue match score from 0-100.
 */
function calculateFitScore(issue) {
  const result = calculateMatchScore(issue);
  return {
    ...result,
    logs: result.rows.map(row => `${row.points >= 0 ? '+' : ''}${row.points} ${row.label}`),
    isAssigned: result.flags.isAssigned,
    hasGoodFirstLabel: result.flags.hasBeginnerLabel,
    hasStaleLabel: result.flags.hasStaleLabel
  };
}

/**
 * Returns descriptive tag based on fit score
 */
function getFitScoreRating(score) {
  const rating = getMatchScoreRating(score);
  if (score >= 85) return { rating, colorClass: 'glow-emerald', bgClass: 'bg-tertiary/10 border-tertiary/20 text-tertiary' };
  if (score >= 70) return { rating, colorClass: 'glow-violet', bgClass: 'bg-primary/10 border-primary/20 text-primary' };
  if (score >= 50) return { rating, colorClass: 'text-on-surface-variant', bgClass: 'bg-surface-container-high text-on-surface-variant border-outline-variant' };
  return { rating, colorClass: 'text-error', bgClass: 'bg-error-container/20 border-error/20 text-error' };
}

function getInspectorBestFitLabel(bestFor) {
  if (bestFor === 'Standard') return 'Standard contributor';
  if (bestFor === 'Deep Dive') return 'Deep dive';
  return bestFor;
}

/**
 * Global Routing Navigation Bindings
 */
function setupNavigation() {
  const tabs = [
    { id: 'dashboard', navId: 'tab-dashboard', mobileId: 'mobile-tab-dashboard' },
    { id: 'find-issues', navId: 'tab-find-issues', mobileId: 'mobile-tab-find-issues' },
    { id: 'board', navId: 'tab-board', mobileId: 'mobile-tab-board' },
    { id: 'settings', navId: 'btn-settings', mobileId: 'mobile-tab-settings' }
  ];

  tabs.forEach(tab => {
    // Desktop Sidebar Tabs
    const el = document.getElementById(tab.navId);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.location.hash !== `#${tab.id}`) {
          window.location.hash = tab.id;
        } else {
          store.setScreen(tab.id);
        }
      });
    }

    // Mobile Drawer Tabs
    const mobileEl = document.getElementById(tab.mobileId);
    if (mobileEl) {
      mobileEl.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.location.hash !== `#${tab.id}`) {
          window.location.hash = tab.id;
        } else {
          store.setScreen(tab.id);
        }
        closeMobileMenu();
      });
    }
  });

  // Mobile Menu triggers
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const closeBtn = document.getElementById('mobile-menu-close');
  const drawer = document.getElementById('mobile-nav-drawer');

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => {
      drawer.style.display = 'flex';
    });
  }
  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', closeMobileMenu);
  }

  // Profile Avatar clicking takes to settings
  const avatar = document.getElementById('user-profile-avatar');
  if (avatar) {
    avatar.addEventListener('click', () => {
      if (window.location.hash !== '#settings') {
        window.location.hash = 'settings';
      } else {
        store.setScreen('settings');
      }
    });
  }

  // Setup click triggers on active window location hashes
  window.addEventListener('hashchange', () => {
    store.setScreen(screenFromHash(window.location.hash));
  });
}

function closeMobileMenu() {
  const drawer = document.getElementById('mobile-nav-drawer');
  if (drawer) drawer.style.display = 'none';
}

function updateSidebarActiveState(activeScreen) {
  // Update desktop side-nav links classes
  const tabIds = {
    'dashboard': 'tab-dashboard',
    'find-issues': 'tab-find-issues',
    'board': 'tab-board',
    'settings': 'btn-settings'
  };

  Object.entries(tabIds).forEach(([screen, elementId]) => {
    const el = document.getElementById(elementId);
    if (el) {
      if (screen === activeScreen) {
        el.classList.add('active');
        // Find icon inside and check filled variation
        const icon = el.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.add('filled-icon');
      } else {
        el.classList.remove('active');
        const icon = el.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.remove('filled-icon');
      }
    }
  });

  // Mobile drawer links
  const mobileTabIds = {
    'dashboard': 'mobile-tab-dashboard',
    'find-issues': 'mobile-tab-find-issues',
    'board': 'mobile-tab-board',
    'settings': 'mobile-tab-settings'
  };

  Object.entries(mobileTabIds).forEach(([screen, elementId]) => {
    const el = document.getElementById(elementId);
    if (el) {
      if (screen === activeScreen) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  });
}

function setupGlobalSearch() {
  const input = document.getElementById('global-search-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value.trim();
        store.setSearchQuery(val);
        store.setFinderMode('find');
        store.applyDraftFilters();
        store.setScreen('find-issues');
        searchGitHubIssues(val, true, { mode: 'find', filters: store.filters });
        input.value = '';
      }
    });
  }
}

function updateRateLimitBadge(rateLimit) {
  const badge = document.getElementById('rate-limit-badge');
  const remEl = document.getElementById('rate-limit-remaining');
  const limEl = document.getElementById('rate-limit-limit');
  
  if (badge && remEl && limEl) {
    if (rateLimit.remaining !== null) {
      badge.style.display = 'block';
      remEl.textContent = rateLimit.remaining;
      limEl.textContent = rateLimit.limit;
      
      // Warn if rate limit is dangerously low
      if (rateLimit.remaining < 5) {
        badge.classList.remove('bg-surface-container', 'border-outline-variant');
        badge.classList.add('bg-error-container/20', 'border-error/30', 'text-error');
      } else {
        badge.classList.remove('bg-error-container/20', 'border-error/30', 'text-error');
        badge.classList.add('bg-surface-container', 'border-outline-variant', 'text-on-surface-variant');
      }
    } else {
      badge.style.display = 'none';
    }
  }
}

/**
 * Screen Router render delegation
 */
function renderActiveScreen() {
  const container = document.getElementById('app-content');
  if (!container) return;

  switch (store.currentScreen) {
    case 'dashboard':
      renderDashboard(container);
      break;
    case 'find-issues':
      renderFindIssues(container);
      break;
    case 'board':
      renderBoard(container);
      break;
    case 'settings':
      renderSettings(container);
      break;
    default:
      renderDashboard(container);
  }
}

/**
 * ----------------------------------------------------
 * SCREEN RENDERERS
 * ----------------------------------------------------
 */

/**
 * 1. DASHBOARD VIEW
 */
function renderDashboard(container) {
  // Grab dynamic data
  const boardCards = Object.values(store.boardCards).flat();
  const closedCards = boardCards.filter(isClosedIssue);
  const activeCards = boardCards.filter(card => !isClosedIssue(card));
  const dashboardSavedCards = activeCards.length ? activeCards : boardCards;
  const mergedOrPassedCount = (store.boardCards["Merged"] || []).length + (store.boardCards["Passed"] || []).length + closedCards.length;
  const heroRecommendation = getDashboardHeroRecommendation({
    boardCards: store.boardCards,
    githubToken: store.githubToken
  });

  let heroHTML = '';
  if (heroRecommendation.kind === 'resume') {
    const resumeReviewCard = heroRecommendation.card;
    const resumeTitle = escapeHTML(resumeReviewCard.title);
    const resumeRepo = escapeHTML(resumeReviewCard.repository?.full_name || resumeReviewCard.repository?.name || 'github');
    const resumeNumber = safeInteger(resumeReviewCard.number);
    const resumeId = safeInteger(resumeReviewCard.id);
    const resumeColumn = escapeHTML(heroRecommendation.column);
    heroHTML = `
      <div class="glass-card rounded-xl p-8 relative overflow-hidden group mb-8">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-primary text-[20px] filled-icon">bolt</span>
              <span class="text-primary font-semibold text-sm tracking-wide uppercase">Next Recommended Action</span>
            </div>
            <h2 class="text-2xl font-headline font-bold text-on-surface tracking-tight mb-2">Continue Review: ${resumeTitle}</h2>
            <p class="text-on-surface-variant max-w-xl">${resumeRepo} #${resumeNumber} - Saved in ${resumeColumn}. Open it to continue your local review.</p>
          </div>
          <button class="shrink-0 bg-primary text-on-primary font-medium px-6 py-3 rounded-lg hover:bg-primary-container transition-colors active:scale-95 flex items-center gap-2" id="hero-resume-btn" data-id="${resumeId}">
            Resume Review
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  } else if (heroRecommendation.kind === 'configure-token') {
    heroHTML = `
      <div class="glass-card rounded-xl p-8 relative overflow-hidden group mb-8">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-primary text-[20px] filled-icon">bolt</span>
              <span class="text-primary font-semibold text-sm tracking-wide uppercase">Next Recommended Action</span>
            </div>
            <h2 class="text-2xl font-headline font-bold text-on-surface tracking-tight mb-2">Configure Personal Access Token</h2>
            <p class="text-on-surface-variant max-w-xl">Configure a Personal Access Token in Settings to increase GitHub API rate limits for searches and lookups.</p>
          </div>
          <button class="shrink-0 bg-primary text-on-primary font-medium px-6 py-3 rounded-lg hover:bg-primary-container transition-colors active:scale-95 flex items-center gap-2" id="hero-action-btn">
            Go to Settings
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  } else {
    heroHTML = `
      <div class="glass-card rounded-xl p-8 relative overflow-hidden group mb-8">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-primary text-[20px] filled-icon">bolt</span>
              <span class="text-primary font-semibold text-sm tracking-wide uppercase">Next Recommended Action</span>
            </div>
            <h2 class="text-2xl font-headline font-bold text-on-surface tracking-tight mb-2">Find Contributions</h2>
            <p class="text-on-surface-variant max-w-xl">Your token is configured. Search for contribution-worthy GitHub issues and save the best candidates to your board.</p>
          </div>
          <button class="shrink-0 bg-primary text-on-primary font-medium px-6 py-3 rounded-lg hover:bg-primary-container transition-colors active:scale-95 flex items-center gap-2" id="hero-find-btn">
            Find Contributions
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  }

  // Saved Issues lists the Board Considering lane (or mocks if empty)
  let savedIssuesHTML = '';
  if (dashboardSavedCards.length === 0) {
    savedIssuesHTML = `
      <div class="p-6 rounded-lg bg-surface-container-lowest border border-outline-variant text-center flex flex-col items-center justify-center gap-2 py-10">
        <span class="material-symbols-outlined text-on-surface-variant text-3xl">bookmarks</span>
        <h4 class="text-on-surface font-medium">No saved issues</h4>
        <p class="text-xs text-on-surface-variant max-w-xs">Save issues from Find Contributions results to see them listed in your Dashboard panel.</p>
        <button class="mt-2 px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-semibold hover:bg-primary-container" id="dash-go-find-btn">Browse Issues</button>
      </div>
    `;
  } else {
    savedIssuesHTML = dashboardSavedCards.slice(0, 3).map(issue => {
      const fitObj = calculateFitScore(issue);
      const { score } = fitObj;
      const rating = getFitScoreRating(score);
      const contributionBrief = buildContributionBrief(issue, fitObj);
      const labelsSlice = (issue.labels || []).slice(0, 2);
      const labelsHTML = labelsSlice.map(l => {
        const name = String(typeof l === 'object' ? l.name : l || '');
        return `<span class="text-xs text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">sell</span> ${escapeHTML(name)}</span>`;
      }).join(' ');
      const issueId = safeInteger(issue.id);
      const repoName = escapeHTML(issue.repository?.full_name || issue.repository?.name || 'github');
      const issueTitle = escapeHTML(issue.title);
      const issueDate = escapeHTML(formatDate(issue.updated_at));

      return `
        <div class="p-4 rounded-lg bg-surface-container-lowest border border-outline-variant hover:border-primary/50 transition-colors cursor-pointer group dashboard-issue-card" data-id="${issueId}">
          <div class="flex justify-between items-start mb-1">
            <span class="text-xs font-mono text-on-surface-variant">${repoName}</span>
            <div class="flex flex-wrap justify-end gap-1">
              <div class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${rating.bgClass}">
                <span class="w-1.5 h-1.5 rounded-full ${score >= 75 ? 'bg-tertiary animate-pulse' : 'bg-outline'}"></span>
                ${score}% Match
              </div>
              <span class="px-2 py-0.5 rounded text-xs border border-primary/20 bg-primary/10 text-primary whitespace-nowrap">Fit: ${escapeHTML(contributionBrief.bestFor)}</span>
            </div>
          </div>
          <h4 class="text-on-surface font-medium group-hover:text-primary transition-colors leading-snug">${issueTitle}</h4>
          <div class="mt-3 flex items-center gap-3">
            ${labelsHTML}
            <span class="text-xs text-on-surface-variant flex items-center gap-1 ml-auto"><span class="material-symbols-outlined text-[14px]">schedule</span> ${issueDate}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  const localReviewHTML = `
    <div class="p-6 rounded-lg bg-surface-container-lowest border border-outline-variant text-center flex flex-col items-center justify-center gap-2 py-10">
      <span class="material-symbols-outlined text-on-surface-variant text-3xl">commit</span>
      <h4 class="text-on-surface font-medium">No local review in progress</h4>
      <p class="text-xs text-on-surface-variant max-w-xs">Saved GitHub issues appear on the board after you save them from search.</p>
    </div>
  `;

  container.innerHTML = `
    <section class="p-6 md:p-8">
      <div class="max-w-7xl mx-auto">
        
        <!-- Hero Recommended Section -->
        ${heroHTML}
        
        <!-- Stats Row -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="bg-surface-container rounded-lg border border-outline-variant p-6 flex flex-col gap-2 hover:bg-surface-container-high transition-colors">
            <div class="flex justify-between items-start">
              <span class="text-on-surface-variant text-sm font-medium">Resolved / Passed</span>
              <span class="material-symbols-outlined text-tertiary">merge</span>
            </div>
            <div class="flex items-end gap-3 mt-2">
              <span class="text-4xl font-headline font-bold text-on-surface">${mergedOrPassedCount}</span>
              <span class="text-on-surface-variant text-sm mb-1">From saved board</span>
            </div>
          </div>
          
          <div class="bg-surface-container rounded-lg border border-outline-variant p-6 flex flex-col gap-2 hover:bg-surface-container-high transition-colors">
            <div class="flex justify-between items-start">
              <span class="text-on-surface-variant text-sm font-medium">Saved Issues</span>
              <span class="material-symbols-outlined text-primary">bug_report</span>
            </div>
            <div class="flex items-end gap-3 mt-2">
              <span class="text-4xl font-headline font-bold text-on-surface">${boardCards.length}</span>
              <span class="text-on-surface-variant text-sm mb-1">Local board total</span>
            </div>
          </div>
          
          <div class="bg-surface-container rounded-lg border border-outline-variant p-6 flex flex-col gap-2 hover:bg-surface-container-high transition-colors">
            <div class="flex justify-between items-start">
              <span class="text-on-surface-variant text-sm font-medium">Active Candidates</span>
              <span class="material-symbols-outlined text-tertiary filled-icon">radio_button_checked</span>
            </div>
            <div class="flex items-end gap-3 mt-2">
              <span class="text-4xl font-headline font-bold text-on-surface">${activeCards.length}</span>
              <span class="text-on-surface-variant text-sm mb-1">Open saved issues</span>
            </div>
          </div>
        </div>
        
        <!-- Bento Grid Contents -->
        <div class="bento-grid">
          <!-- Saved Issues (Bento Large) -->
          <div class="bento-item bento-large bg-surface-container border border-outline-variant p-6 flex flex-col gap-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-headline font-bold text-on-surface tracking-tight flex items-center gap-2">
                <span class="material-symbols-outlined text-on-surface-variant">bookmarks</span>
                Saved Issues
              </h3>
              <button class="text-primary text-sm font-medium hover:underline" id="dash-view-board-btn" style="background:none; border:none;">View Kanban Board</button>
            </div>
            <div class="flex flex-col gap-3">
              ${savedIssuesHTML}
            </div>
          </div>
          
          <!-- Local Review -->
          <div class="bento-item bg-surface-container border border-outline-variant p-6 flex flex-col gap-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-headline font-bold text-on-surface tracking-tight flex items-center gap-2">
                <span class="material-symbols-outlined text-on-surface-variant">commit</span>
                Local Review
              </h3>
            </div>
            <div class="flex flex-col gap-4">
              ${localReviewHTML}
            </div>
            <button class="mt-auto w-full py-2 border border-outline-variant rounded bg-surface-container-lowest text-on-surface-variant text-sm hover:bg-surface-container-high hover:text-on-surface transition-colors font-medium" id="dash-view-local-review-btn">
              View Board
            </button>
          </div>
        </div>
        
      </div>
    </section>
  `;

  // Bind events
  const heroAction = document.getElementById('hero-action-btn');
  if (heroAction) {
    heroAction.addEventListener('click', () => {
      store.setScreen('settings');
    });
  }

  const heroFind = document.getElementById('hero-find-btn');
  if (heroFind) {
    heroFind.addEventListener('click', () => {
      store.setScreen('find-issues');
    });
  }

  const heroResume = document.getElementById('hero-resume-btn');
  if (heroResume) {
    heroResume.addEventListener('click', () => {
      const cardId = parseInt(heroResume.getAttribute('data-id'), 10);
      const allCards = Object.values(store.boardCards).flat();
      const card = allCards.find(c => c.id === cardId);
      if (card) {
        store.setInspectedIssue(card);
        openInspector();
      }
    });
  }

  const browseBtn = document.getElementById('dash-go-find-btn');
  if (browseBtn) {
    browseBtn.addEventListener('click', () => {
      store.setScreen('find-issues');
    });
  }

  const kanbanBtn = document.getElementById('dash-view-board-btn');
  if (kanbanBtn) {
    kanbanBtn.addEventListener('click', () => {
      store.setScreen('board');
    });
  }

  const localReviewBtn = document.getElementById('dash-view-local-review-btn');
  if (localReviewBtn) {
    localReviewBtn.addEventListener('click', () => {
      store.setScreen('board');
    });
  }

  // Dashboard card clicks open inspector
  document.querySelectorAll('.dashboard-issue-card').forEach(card => {
    card.addEventListener('click', () => {
      const issueId = parseInt(card.getAttribute('data-id'), 10);
      const allCards = Object.values(store.boardCards).flat();
      const match = allCards.find(c => c.id === issueId);
      if (match) {
        store.setInspectedIssue(match);
        openInspector();
      }
    });
  });
}

/**
 * 2. FIND ISSUES VIEW
 */
function describeActiveFilters(filters) {
  const parts = [];
  if (filters.languages?.length) parts.push(`Languages: ${filters.languages.join(', ')}`);
  if (filters.labels?.length) parts.push(`Labels: ${filters.labels.join(' OR ')}`);
  if (filters.stars && filters.stars !== 'Any') parts.push(`Stars: ${filters.stars}`);
  if (filters.comments && filters.comments !== 'Any') parts.push(`Comments: ${filters.comments}`);
  if (filters.updatedDate && filters.updatedDate !== 'Any') parts.push(`Updated: ${filters.updatedDate}`);
  if (filters.includeClosed) parts.push('Includes closed issues');
  return parts.length ? parts : ['No restrictive filters'];
}

function getFirstRelaxationHint(filters) {
  if (filters.labels?.length > 1) return 'Relax labels first: try only help wanted.';
  if (filters.stars && filters.stars !== 'Any') return 'Relax stars first: switch stars to Any.';
  if (filters.comments && filters.comments !== 'Any') return 'Relax comments first: switch comments to Any.';
  if (filters.languages?.length) return 'Relax language first: clear selected languages.';
  if (filters.updatedDate && filters.updatedDate !== 'Any') return 'Relax updated date first: switch updated date to Any.';
  return 'Try a broader keyword or remove repository-specific terms.';
}

function renderNoResults(queryPreview, filters) {
  const filtersHTML = describeActiveFilters(filters)
    .map(filter => `<li>${escapeHTML(filter)}</li>`)
    .join('');

  return `
    <div class="p-8 rounded-lg bg-surface-container border border-outline-variant flex flex-col gap-5">
      <div class="flex items-start gap-4">
        <span class="material-symbols-outlined text-on-surface-variant text-4xl">search_off</span>
        <div>
          <h3 class="text-on-surface font-medium text-lg mb-1">No matching open issues found</h3>
          <p class="text-sm text-on-surface-variant">GitHub returned zero issues for the current query and filters.</p>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
        <div class="rounded border border-outline-variant bg-surface-container-lowest p-4">
          <div class="text-xs uppercase tracking-wider text-on-surface-variant mb-2">Exact query sent</div>
          <code class="text-xs text-on-surface break-words">${escapeHTML(queryPreview)}</code>
        </div>
        <div class="rounded border border-outline-variant bg-surface-container-lowest p-4">
          <div class="text-xs uppercase tracking-wider text-on-surface-variant mb-2">Active filters</div>
          <ul class="list-disc list-inside text-on-surface-variant space-y-1">${filtersHTML}</ul>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 rounded border border-primary/20 bg-primary/10 p-4">
        <span class="text-sm text-on-surface">${escapeHTML(getFirstRelaxationHint(filters))}</span>
        <button class="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary-container" id="relax-filters-btn">Relax Filters</button>
      </div>
    </div>
  `;
}

function updateQueryPreviewText(value) {
  const preview = document.getElementById('github-query-preview');
  if (preview) {
    const exactLookup = store.finderMode === 'lookup'
      ? parseExactLookupInput(value, { repoContext: store.lookupRepoContext })
      : null;
    preview.textContent = exactLookup
      ? `GET ${buildExactIssueApiUrl(exactLookup)}`
      : buildQueryPreview(value, store.draftFilters, { mode: store.finderMode });
  }
}

async function runFinderSearch(value) {
  const queryValue = String(value ?? store.searchQuery ?? '').trim();
  store.setSearchQuery(queryValue);
  const appliedFilters = store.applyDraftFilters();
  const mode = store.finderMode;

  if (mode === 'lookup') {
    const exact = parseExactLookupInput(queryValue, { repoContext: store.lookupRepoContext });
    if (exact) {
      return fetchExactIssue(exact);
    }
  }

  return searchGitHubIssues(queryValue, true, { mode, filters: appliedFilters });
}

function renderFindIssues(container) {
  const results = store.searchResults;
  const visibleResults = Array.isArray(results) ? filterHiddenIssues(results) : results;
  const hiddenResultsCount = Array.isArray(results) && Array.isArray(visibleResults)
    ? results.length - visibleResults.length
    : 0;
  const hiddenCountText = hiddenResultsCount > 0 ? ` (${hiddenResultsCount} hidden)` : '';
  const loading = store.searchLoading;
  const error = store.searchError;
  const filters = store.draftFilters;
  const appliedFilters = store.filters;
  const mode = store.finderMode;
  const exactLookup = mode === 'lookup'
    ? parseExactLookupInput(store.searchQuery, { repoContext: store.lookupRepoContext })
    : null;
  const queryPreview = exactLookup
    ? `GET ${buildExactIssueApiUrl(exactLookup)}`
    : buildQueryPreview(store.searchQuery, filters, { mode });
  const filtersChanged = store.hasDraftFilterChanges();
  const isLookupMode = mode === 'lookup';
  const findModeClass = !isLookupMode
    ? 'bg-primary text-on-primary border-primary'
    : 'bg-surface-container text-on-surface-variant border-outline-variant hover:text-on-surface';
  const lookupModeClass = isLookupMode
    ? 'bg-primary text-on-primary border-primary'
    : 'bg-surface-container text-on-surface-variant border-outline-variant hover:text-on-surface';

  // Language checkboxes HTML
  const languages = ['TypeScript', 'Rust', 'Go', 'JavaScript', 'CSS', 'HTML'];
  const languageCheckboxes = languages.map(lang => {
    const checked = filters.languages.includes(lang) ? 'checked' : '';
    const safeLang = escapeHTML(lang);
    return `
      <label class="flex items-center gap-3 group cursor-pointer">
        <input class="lang-filter-checkbox" type="checkbox" data-lang="${safeLang}" ${checked} />
        <span class="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">${safeLang}</span>
      </label>
    `;
  }).join('');

  // Labels clickable HTML
  const labelOptions = ['good first issue', 'help wanted', 'bug', 'enhancement', 'docs', 'performance'];
  const labelsBadges = labelOptions.map(label => {
    const active = filters.labels.includes(label);
    const btnClass = active 
      ? 'border-primary bg-primary/10 text-primary' 
      : 'border-outline-variant bg-surface-container hover:border-primary text-on-surface-variant hover:text-on-surface';
    const safeLabel = escapeHTML(label);
    return `
      <button class="px-2.5 py-1 text-xs rounded border preset-badge label-filter-btn ${btnClass}" data-label="${safeLabel}">${safeLabel}</button>
    `;
  }).join('');

  // Stars radio buttons HTML
  const starOptions = ['Any', '1k+', '5k+', '10k+'];
  const starsRadioHTML = starOptions.map(starOpt => {
    const checked = filters.stars === starOpt ? 'checked' : '';
    const safeStarOpt = escapeHTML(starOpt);
    return `
      <label class="flex items-center gap-3 group cursor-pointer">
        <input class="stars-filter-radio" type="radio" name="stars" data-value="${safeStarOpt}" ${checked} />
        <span class="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">${safeStarOpt}</span>
      </label>
    `;
  }).join('');

  // Results rendering
  let resultsHTML = '';
  let countText = 'Enter keywords and click search';

  if (loading) {
    resultsHTML = `
      <div class="flex flex-col items-center justify-center py-20 gap-4">
        <div class="spinner"></div>
        <p class="text-sm text-on-surface-variant font-medium">Fetching developer-grade matches from GitHub API...</p>
      </div>
    `;
    countText = 'Searching GitHub...';
  } else if (error) {
    resultsHTML = `
      <div class="flex flex-col gap-6">
        <div class="bg-error-container/15 border border-error/30 rounded-lg p-5 flex items-start gap-4">
          <span class="material-symbols-outlined text-error mt-0.5">warning</span>
          <div>
            <h3 class="text-sm font-semibold text-error mb-1">Search Connection Failure</h3>
            <p class="text-sm text-on-error-container leading-relaxed">${escapeHTML(error)}</p>
          </div>
        </div>
        
        ${visibleResults ? renderIssueCardsList(visibleResults) : ''}
      </div>
    `;
    countText = visibleResults ? `Showing ${visibleResults.length} issues${hiddenCountText}` : 'Request failed';
  } else if (visibleResults !== null) {
    countText = `Showing ${visibleResults.length} ${appliedFilters.includeClosed || store.lastSearchMode === 'lookup' ? 'issues' : 'open issues'}${hiddenCountText}`;
    if (visibleResults.length === 0) {
      resultsHTML = renderNoResults(queryPreview, filters);
    } else {
      resultsHTML = renderIssueCardsList(visibleResults);
    }
  } else {
    // Initial screen state - explain Token details
    const token = store.githubToken;
    countText = 'No search run yet';
    resultsHTML = `
      <div class="mb-6 flex flex-col items-center justify-center text-center gap-4 border border-outline-variant bg-surface-container-lowest rounded-xl p-6">
        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <span class="material-symbols-outlined text-3xl filled-icon">terminal</span>
        </div>
        <div>
          <h2 class="text-2xl font-headline font-bold text-on-surface mb-2">Find your next contribution</h2>
          <p class="text-sm text-on-surface-variant leading-relaxed">
            Query the official GitHub REST API directly from your browser. Filter by stars, programming language, issue tags, and comments count.
          </p>
        </div>
        
        <div class="w-full callout p-4 rounded-lg flex items-start gap-3 bg-surface-container text-left border-outline-variant">
          <span class="material-symbols-outlined text-primary mt-0.5">info</span>
          <div class="text-xs text-on-surface-variant leading-relaxed">
            <strong>GitHub API Rate Limits</strong>: Public searches without a Personal Access Token are rate-limited to 10 requests per minute by GitHub. 
            ${token ? '<span class="text-tertiary">You currently have a Token active!</span>' : 'You can paste an optional fine-grained token in the <strong>Settings</strong> screen to increase these limits.'}
          </div>
        </div>
        
        <button class="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary-container transition-colors" id="start-search-btn">
          Perform Initial Query
        </button>
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Find Issues layout -->
    <div class="bg-background flex min-h-[calc(100vh-3.5rem)] flex-col relative hide-scrollbar">
      
      <!-- Command Palette Search Hero -->
      <section class="w-full pt-12 pb-8 px-6 md:px-8 border-b border-outline-variant/30 bg-surface-container-lowest relative">
        <div class="max-w-3xl mx-auto relative z-10">
          <h1 class="text-3xl font-headline font-bold text-on-surface mb-6 tracking-tight text-center">Find your next contribution</h1>
          <div class="mb-4 flex justify-center">
            <div class="inline-flex rounded-lg border border-outline-variant bg-surface-container-lowest p-1" role="group" aria-label="Finder mode">
              <button class="finder-mode-btn rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${findModeClass}" data-mode="find" type="button">Find Contributions</button>
              <button class="finder-mode-btn rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${lookupModeClass}" data-mode="lookup" type="button">Lookup</button>
            </div>
          </div>
          
          <!-- Command Bar -->
          <div class="flex gap-3">
            <div class="relative flex-1 group">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span class="material-symbols-outlined text-primary text-xl group-focus-within:text-tertiary transition-colors">search</span>
              </div>
              <input class="block w-full pl-12 pr-4 py-3.5 bg-surface-container border border-outline-variant rounded-xl text-base text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" id="search-keyword-input" placeholder="${isLookupMode ? 'Paste an issue URL, owner/repo#123, or search literally...' : 'Search issues, labels, or repositories...'}" type="text" value="${escapeHTML(store.searchQuery)}"/>
            </div>
            <button class="px-6 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary-container transition-colors active:scale-95 shrink-0" id="search-trigger-btn">
              Search
            </button>
          </div>
          <div class="mt-3 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-left">
            <div class="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">GitHub query preview</div>
            <code class="block text-xs text-on-surface break-words" id="github-query-preview">${escapeHTML(queryPreview)}</code>
          </div>
          
          <!-- Presets -->
          <div class="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button class="px-4 py-1.5 rounded-full bg-surface-container border border-outline-variant text-sm font-medium hover:bg-surface-container-high hover:border-primary/50 text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-2 preset-search-btn" data-preset="quick-wins">
              <span class="material-symbols-outlined text-[16px]">bolt</span> Quick Wins
            </button>
            <button class="px-4 py-1.5 rounded-full bg-surface-container border border-outline-variant text-sm font-medium hover:bg-surface-container-high hover:border-primary/50 text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-2 preset-search-btn" data-preset="deep-dives">
              <span class="material-symbols-outlined text-[16px]">psychology</span> Deep Dives
            </button>
            <button class="px-4 py-1.5 rounded-full bg-surface-container border border-outline-variant text-sm font-medium hover:bg-surface-container-high hover:border-primary/50 text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-2 preset-search-btn" data-preset="docs-only">
              <span class="material-symbols-outlined text-[16px]">description</span> Documentation Only
            </button>
            <button class="px-4 py-1.5 rounded-full bg-surface-container border border-outline-variant text-sm font-medium hover:bg-surface-container-high hover:border-primary/50 text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-2 preset-search-btn" data-preset="low-noise">
              <span class="material-symbols-outlined text-[16px]">volume_down</span> Low Noise
            </button>
          </div>
        </div>
      </section>
      
      <!-- Main Workspace: Filters + Results -->
      <div class="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-8">
        
        <!-- Left Sidebar Filters -->
        <aside class="w-full lg:w-56 shrink-0 flex flex-col gap-6" id="find-issues-sidebar">
          <div class="flex flex-col gap-3 pb-5 border-b border-outline-variant/30">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-xs font-semibold text-on-surface uppercase tracking-wider">Filters</h3>
              ${filtersChanged ? '<span class="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Changed</span>' : '<span class="rounded-full border border-outline-variant px-2 py-0.5 text-[10px] text-on-surface-variant">Applied</span>'}
            </div>
            <button class="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container transition-colors" id="apply-filters-btn">
              Apply Filters
            </button>
            ${isLookupMode ? `
              <label class="flex items-start gap-3 group cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
                <input class="lookup-filter-checkbox mt-0.5" type="checkbox" ${filters.useFiltersInLookup ? 'checked' : ''} />
                <span class="text-xs text-on-surface-variant group-hover:text-on-surface transition-colors">Use filters in Lookup</span>
              </label>
            ` : ''}
          </div>
          
          <!-- Language Filter -->
          <div class="flex flex-col gap-3 pb-5 border-b border-outline-variant/30">
            <h3 class="text-xs font-semibold text-on-surface uppercase tracking-wider">Language</h3>
            <div class="flex flex-col gap-2">
              ${languageCheckboxes}
            </div>
          </div>
          
          <!-- Labels Filter -->
          <div class="flex flex-col gap-3 pb-5 border-b border-outline-variant/30">
            <h3 class="text-xs font-semibold text-on-surface uppercase tracking-wider">Labels</h3>
            <div class="flex flex-wrap gap-2">
              ${labelsBadges}
            </div>
          </div>
          
          <!-- Stars Filter -->
          <div class="flex flex-col gap-3 pb-5 border-b border-outline-variant/30">
            <h3 class="text-xs font-semibold text-on-surface uppercase tracking-wider">Stars</h3>
            <div class="flex flex-col gap-2">
              ${starsRadioHTML}
            </div>
          </div>
          
          <!-- Comments Filter -->
          <div class="flex flex-col gap-3 pb-5 border-b border-outline-variant/30">
            <h3 class="text-xs font-semibold text-on-surface uppercase tracking-wider">Comments</h3>
            <select class="p-2" id="comments-filter-select">
              <option ${filters.comments === 'Any' ? 'selected' : ''}>Any</option>
              <option ${filters.comments === 'Low (0-5)' ? 'selected' : ''}>Low (0-5)</option>
              <option ${filters.comments === 'Medium (6-15)' ? 'selected' : ''}>Medium (6-15)</option>
              <option ${filters.comments === 'High (15+)' ? 'selected' : ''}>High (15+)</option>
            </select>
          </div>

          <!-- Updated Date Filter -->
          <div class="flex flex-col gap-3 pb-5 border-b border-outline-variant/30">
            <h3 class="text-xs font-semibold text-on-surface uppercase tracking-wider">Updated Date</h3>
            <select class="p-2" id="updated-filter-select">
              <option ${filters.updatedDate === 'Any' ? 'selected' : ''}>Any</option>
              <option ${filters.updatedDate === 'Last 24h' ? 'selected' : ''}>Last 24h</option>
              <option ${filters.updatedDate === 'Last week' ? 'selected' : ''}>Last week</option>
              <option ${filters.updatedDate === 'Last month' ? 'selected' : ''}>Last month</option>
            </select>
          </div>

          <div class="flex flex-col gap-3 pb-5 border-b border-outline-variant/30">
            <h3 class="text-xs font-semibold text-on-surface uppercase tracking-wider">State</h3>
            <label class="flex items-center gap-3 group cursor-pointer">
              <input class="include-closed-checkbox" type="checkbox" ${filters.includeClosed ? 'checked' : ''} />
              <span class="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">Include closed issues</span>
            </label>
            <label class="flex items-center gap-3 group cursor-pointer">
              <input class="unassigned-checkbox" type="checkbox" ${filters.unassigned ? 'checked' : ''} />
              <span class="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">Unassigned only</span>
            </label>
          </div>
          
        </aside>
        
        <!-- Results Content viewport -->
        <div class="flex-1 flex flex-col">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-sm font-medium text-on-surface-variant" id="results-count-label">${countText}</h2>
            <div class="flex items-center gap-2 text-sm text-on-surface-variant">
              <span>Sort by:</span>
              <select class="bg-transparent border-none text-on-surface focus:ring-0 cursor-pointer font-medium p-0 pr-4" id="sort-filter-select" style="border:none; padding-right:16px;">
                <option ${filters.sortMode === 'Fit Score' ? 'selected' : ''}>Fit Score</option>
                <option ${filters.sortMode === 'Updated Date' ? 'selected' : ''}>Updated Date</option>
                <option ${filters.sortMode === 'Most Commented' ? 'selected' : ''}>Most Commented</option>
                <option ${filters.sortMode === 'Recently Created' ? 'selected' : ''}>Recently Created</option>
              </select>
            </div>
          </div>
          
          <div class="flex-1" id="search-results-viewport">
            ${resultsHTML}
          </div>
        </div>
        
      </div>
    </div>
  `;

  // Bind actions
  const startBtn = document.getElementById('start-search-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      runFinderSearch(store.searchQuery);
    });
  }

  document.querySelectorAll('.finder-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.setFinderMode(btn.getAttribute('data-mode'));
    });
  });

  const triggerBtn = document.getElementById('search-trigger-btn');
  const keywordInput = document.getElementById('search-keyword-input');
  if (triggerBtn && keywordInput) {
    triggerBtn.addEventListener('click', () => {
      const val = keywordInput.value.trim();
      runFinderSearch(val);
    });
    keywordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = keywordInput.value.trim();
        runFinderSearch(val);
      }
    });
    keywordInput.addEventListener('input', () => {
      const val = keywordInput.value.trim();
      store.setSearchQuery(val);
      updateQueryPreviewText(val);
    });
  }

  // Preset quick filters
  document.querySelectorAll('.preset-search-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      store.setFinderMode('find');
      applyPresetSearch(store, preset, (query, forceRefresh) => searchGitHubIssues(query, forceRefresh, {
        mode: 'find',
        filters: store.filters
      }));
    });
  });

  const applyFiltersBtn = document.getElementById('apply-filters-btn');
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', () => {
      runFinderSearch(store.searchQuery);
    });
  }

  const relaxBtn = document.getElementById('relax-filters-btn');
  if (relaxBtn) {
    relaxBtn.addEventListener('click', () => {
      applyFilterPatch(store, getRelaxedFilters());
    });
  }

  // Checkbox filters
  document.querySelectorAll('.lang-filter-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const selected = [];
      document.querySelectorAll('.lang-filter-checkbox').forEach(c => {
        if (c.checked) selected.push(c.getAttribute('data-lang'));
      });
      applyFilterPatch(store, { languages: selected });
    });
  });

  // Label filter buttons
  document.querySelectorAll('.label-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.getAttribute('data-label');
      let current = [...filters.labels];
      if (current.includes(label)) {
        current = current.filter(l => l !== label);
      } else {
        current.push(label);
      }
      applyFilterPatch(store, { labels: current });
    });
  });

  // Stars radio buttons
  document.querySelectorAll('.stars-filter-radio').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        applyFilterPatch(store, { stars: radio.getAttribute('data-value') });
      }
    });
  });

  // Select dropdowns
  const commentsSelect = document.getElementById('comments-filter-select');
  if (commentsSelect) {
    commentsSelect.addEventListener('change', () => {
      applyFilterPatch(store, { comments: commentsSelect.value });
    });
  }

  const updatedSelect = document.getElementById('updated-filter-select');
  if (updatedSelect) {
    updatedSelect.addEventListener('change', () => {
      applyFilterPatch(store, { updatedDate: updatedSelect.value });
    });
  }

  const includeClosedCheckbox = document.querySelector('.include-closed-checkbox');
  if (includeClosedCheckbox) {
    includeClosedCheckbox.addEventListener('change', () => {
      applyFilterPatch(store, { includeClosed: includeClosedCheckbox.checked });
    });
  }

  const unassignedCheckbox = document.querySelector('.unassigned-checkbox');
  if (unassignedCheckbox) {
    unassignedCheckbox.addEventListener('change', () => {
      applyFilterPatch(store, { unassigned: unassignedCheckbox.checked });
    });
  }

  const lookupFilterCheckbox = document.querySelector('.lookup-filter-checkbox');
  if (lookupFilterCheckbox) {
    lookupFilterCheckbox.addEventListener('change', () => {
      applyFilterPatch(store, { useFiltersInLookup: lookupFilterCheckbox.checked });
    });
  }

  const sortSelect = document.getElementById('sort-filter-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      applyFilterPatch(store, { sortMode: sortSelect.value });
    });
  }

  // Bind issue cards actions
  bindIssueCardListEvents();
}

/**
 * Render lists of cards
 */
function renderIssueCardsList(issuesList) {
  // Sort list if local sorting is needed
  let sorted = filterHiddenIssues(issuesList);
  
  // Calculate fit scores and inject them into objects
  sorted = sorted.map(issue => {
    const fitObj = calculateFitScore(issue);
    return { ...issue, fitScore: fitObj.score, fitRating: fitObj };
  });

  // Local sorting for Fit Score (others sorted by API request parameters, but fit is local)
  if (store.filters.sortMode === 'Fit Score') {
    sorted.sort((a, b) => b.fitScore - a.fitScore);
  } else if (store.filters.sortMode === 'Updated Date') {
    sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  } else if (store.filters.sortMode === 'Most Commented') {
    sorted.sort((a, b) => (b.comments || 0) - (a.comments || 0));
  } else if (store.filters.sortMode === 'Recently Created') {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const cardsHTML = sorted.map((issue, index) => {
    const fitObj = issue.fitRating;
    const rating = getFitScoreRating(fitObj.score);
    const contributionBrief = buildContributionBrief(issue, fitObj);
    const repoName = escapeHTML(issue.repository?.full_name || issue.repository?.name || 'github');
    const isFeatured = index === 0 && sorted.length > 1;
    const updatedText = escapeHTML(formatDate(issue.updated_at));
    const stars = issue.repository && issue.repository.stargazers_count ? issue.repository.stargazers_count : 0;
    const starsText = stars >= 1000 ? `${(stars / 1000).toFixed(stars >= 10000 ? 0 : 1)}k` : `${stars}`;
    const forks = issue.repository && issue.repository.forks_count ? issue.repository.forks_count : 0;
    const forksText = forks >= 1000 ? `${(forks / 1000).toFixed(forks >= 10000 ? 0 : 1)}k` : `${forks}`;
    const issueId = safeInteger(issue.id);
    const issueNumber = safeInteger(issue.number);
    const issueComments = safeInteger(issue.comments);
    const issueTitle = escapeHTML(issue.title);
    const issueBody = escapeHTML(issue.body || 'No summary description provided.');
    const issueUrl = getSafeIssueHtmlUrl(issue);
    const repoMetadataUnavailable = Boolean(issue.repository_metadata_unavailable || issue.repository?.metadataUnavailable);
    const lookupRisky = store.lastSearchMode === 'lookup' && !fitObj.isContributionCandidate;
    const lookupWarningHTML = lookupRisky ? `
      <div class="rounded border border-error/25 bg-error-container/10 px-3 py-2 text-xs text-error flex items-center gap-2">
        <span class="material-symbols-outlined text-[15px]">warning</span>
        Not a contribution candidate
      </div>
    ` : '';
    const repoUnavailableHTML = repoMetadataUnavailable ? `
      <span class="rounded border border-outline-variant bg-surface-dim px-2 py-0.5 text-xs text-on-surface-variant">Repo metadata unavailable</span>
    ` : '';

    const labelsHTML = (issue.labels || []).slice(0, 3).map(l => {
      const name = String(typeof l === 'object' ? l.name : l || '');
      const tone = name.includes('help wanted') || name.includes('good first') 
        ? 'border-primary/30 bg-primary/10 text-primary' 
        : name.includes('enhancement') || name.includes('feature') 
          ? 'border-tertiary/30 bg-tertiary/10 text-tertiary'
          : 'border-outline-variant bg-surface-dim text-on-surface-variant';
      return `<span class="px-2 py-0.5 rounded text-xs border ${tone}">${escapeHTML(name)}</span>`;
    }).join(' ');

    const saved = Object.values(store.boardCards).flat().some(c => c.id === issue.id);

    return `
      <article class="issue-card group rounded-xl border border-outline-variant bg-surface-container p-5 cursor-pointer flex flex-col gap-3 transition-colors ${isFeatured ? 'xl:col-span-2' : ''}" data-id="${issueId}">
        <div class="flex items-start justify-between gap-4">
          <div class="flex min-w-0 items-center gap-2">
            <span class="material-symbols-outlined text-tertiary text-sm">radio_button_checked</span>
            <span class="truncate text-xs font-mono text-on-surface-variant">${repoName} #${issueNumber}</span>
          </div>
          <span class="shrink-0 text-xs text-on-surface-variant">Updated ${updatedText}</span>
        </div>
        
        <h3 class="${isFeatured ? 'text-lg' : 'text-base'} font-semibold text-on-surface group-hover:text-primary transition-colors leading-tight pr-title-click" data-id="${issueId}">
          ${issueTitle}
        </h3>
        
        <p class="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">${issueBody}</p>
        ${lookupWarningHTML}
        
        <div class="mt-auto flex flex-wrap items-center gap-2">
          ${labelsHTML}
          <span class="rounded border ${rating.bgClass} px-2 py-0.5 text-xs">${fitObj.score}% Match</span>
          <span class="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">Fit: ${escapeHTML(contributionBrief.bestFor)}</span>
          ${repoUnavailableHTML}
        </div>
        
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/40 pt-4">
          <div class="flex items-center gap-4 text-xs text-on-surface-variant">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">star</span>${starsText}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">fork_right</span>${forksText}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">chat_bubble</span>${issueComments}</span>
            <span class="flex items-center gap-1 ${fitObj.isAssigned ? 'text-primary' : 'text-tertiary'}">
              <span class="material-symbols-outlined text-[15px]">${fitObj.isAssigned ? 'person' : 'person_off'}</span>
              ${fitObj.isAssigned ? 'Assigned' : 'Unassigned'}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded text-xs font-medium transition-colors inspect-issue-btn" data-id="${issueId}">
            Inspect
            </button>
            <button class="px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 save-issue-btn ${saved ? 'bg-tertiary/10 text-tertiary border border-tertiary/20' : 'bg-transparent text-on-surface-variant hover:text-on-surface border border-outline-variant hover:border-on-surface-variant'}" data-id="${issueId}">
              <span class="material-symbols-outlined text-[14px]">${saved ? 'check' : 'bookmark'}</span>
              ${saved ? 'Saved' : 'Save'}
            </button>
            <button class="px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 hide-issue-btn bg-transparent text-on-surface-variant hover:text-on-surface border border-outline-variant hover:border-on-surface-variant" data-id="${issueId}">
              <span class="material-symbols-outlined text-[14px]">visibility_off</span>
              Hide
            </button>
            ${issueUrl ? `<a class="px-3 py-1.5 bg-transparent text-on-surface-variant hover:text-on-surface border border-outline-variant hover:border-on-surface-variant rounded text-xs font-medium transition-colors flex items-center justify-center gap-1" href="${escapeHTML(issueUrl)}" target="_blank" rel="noopener noreferrer">
              GitHub
              <span class="material-symbols-outlined text-[12px]">open_in_new</span>
            </a>` : '<span class="px-3 py-1.5 text-on-surface-variant border border-outline-variant rounded text-xs">GitHub link unavailable</span>'}
          </div>
        </div>
      </article>
    `;
  }).join('');

  return `<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">${cardsHTML}</div>`;
}

function bindIssueCardListEvents() {
  // Title click opens inspector
  document.querySelectorAll('.pr-title-click').forEach(title => {
    title.addEventListener('click', (e) => {
      e.stopPropagation();
      const issueId = parseInt(title.getAttribute('data-id'), 10);
      const items = filterHiddenIssues(store.searchResults || []);
      const issue = items.find(i => i.id === issueId);
      if (issue) {
        store.setInspectedIssue(issue);
        openInspector();
      }
    });
  });

  // Outer card click opens inspector
  document.querySelectorAll('.issue-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Avoid firing if they click an active button inside the card
      if (e.target.closest('button') || e.target.closest('a')) return;
      const issueId = parseInt(card.getAttribute('data-id'), 10);
      const items = filterHiddenIssues(store.searchResults || []);
      const issue = items.find(i => i.id === issueId);
      if (issue) {
        store.setInspectedIssue(issue);
        openInspector();
      }
    });
  });

  // Inspect button click
  document.querySelectorAll('.inspect-issue-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const issueId = parseInt(btn.getAttribute('data-id'), 10);
      const items = filterHiddenIssues(store.searchResults || []);
      const issue = items.find(i => i.id === issueId);
      if (issue) {
        store.setInspectedIssue(issue);
        openInspector();
      }
    });
  });

  // Save button click
  document.querySelectorAll('.save-issue-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const issueId = parseInt(btn.getAttribute('data-id'), 10);
      const items = filterHiddenIssues(store.searchResults || []);
      const issue = items.find(i => i.id === issueId);
      if (issue) {
        const fitObj = calculateFitScore(issue);
        if (store.lastSearchMode === 'lookup' && !fitObj.isContributionCandidate && btn.getAttribute('data-confirm-risk') !== 'true') {
          btn.setAttribute('data-confirm-risk', 'true');
          btn.innerHTML = `<span class="material-symbols-outlined text-[14px]">warning</span> Save anyway?`;
          btn.classList.add('bg-error-container/10', 'text-error', 'border-error/30');
          return;
        }
        store.saveIssueToBoard(issue);
        // Toast / alert indicator
        btn.innerHTML = `<span class="material-symbols-outlined text-[14px]">check</span> Saved`;
        btn.classList.add('bg-tertiary/10', 'text-tertiary', 'border-tertiary/20');
        btn.classList.remove('bg-transparent', 'text-on-surface-variant', 'border-outline-variant');
      }
    });
  });

  // Hide button click
  document.querySelectorAll('.hide-issue-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const issueId = parseInt(btn.getAttribute('data-id'), 10);
      const items = filterHiddenIssues(store.searchResults || []);
      const issue = items.find(i => i.id === issueId);
      if (issue) {
        store.hideIssue(issue);
      }
    });
  });
}

/**
 * 3. KANBAN BOARD VIEW
 */
async function refreshSavedIssuesFromGitHub(statusEl) {
  const nextBoard = {};
  let refreshed = 0;
  let failed = 0;

  for (const column of BOARD_COLUMNS) {
    nextBoard[column] = [];
    for (const card of store.boardCards[column] || []) {
      try {
        const metadata = await fetchIssueMetadata(card);
        nextBoard[column].push(mergeIssueMetadata(card, metadata));
        refreshed += 1;
      } catch {
        nextBoard[column].push({
          ...card,
          refresh_error: 'GitHub refresh failed for this card.',
          last_refreshed_at: new Date().toISOString()
        });
        failed += 1;
      }
    }
  }

  store.setBoardCards(nextBoard);
  const statusMessage = failed
    ? `Refreshed ${refreshed} saved issues. ${failed} could not be refreshed.`
    : `Refreshed ${refreshed} saved issues.`;
  store.setBoardRefreshStatus(statusMessage);
  if (statusEl) statusEl.textContent = statusMessage;
}

function renderBoard(container) {
  const cols = BOARD_COLUMNS;
  const totalCards = Object.values(store.boardCards).flat().length;
  
  // Render Board lane columns
  const columnsHTML = cols.map((col, cIdx) => {
    const cards = store.boardCards[col] || [];
    
    // Column header indicators color dot
    let dotColor = 'bg-outline';
    if (col === 'Working') dotColor = 'bg-primary animate-pulse';
    else if (col === 'Asked Maintainer') dotColor = 'bg-primary';
    else if (col === 'PR Open') dotColor = 'bg-tertiary';
    else if (col === 'Merged') dotColor = 'bg-tertiary';

    const cardsHTML = cards.map(card => {
      const repoName = escapeHTML(card.repository?.full_name || card.repository?.name || 'github');
      const cardId = safeInteger(card.id);
      const cardNumber = safeInteger(card.number);
      const cardTitle = escapeHTML(card.title);
      const cardDate = escapeHTML(formatDate(card.updated_at));
      const cardProgress = safePercent(card.progress || 0);
      const closed = isClosedIssue(card);
      const closedWarningHTML = closed ? `
        <div class="mb-3 rounded border border-error/25 bg-error-container/10 p-2 text-[11px] text-error">
          Closed${card.state_reason ? `: ${escapeHTML(card.state_reason)}` : ''}${card.closed_at ? ` on ${escapeHTML(formatDate(card.closed_at))}` : ''}
          ${col !== 'Passed' ? `<button class="ml-2 underline move-passed-btn" data-id="${cardId}">Move to Passed</button>` : ''}
        </div>
      ` : '';
      const refreshErrorHTML = card.refresh_error ? `
        <div class="mb-3 rounded border border-error/25 bg-error-container/10 p-2 text-[11px] text-error">${escapeHTML(card.refresh_error)}</div>
      ` : '';
      
      // Inline checklist for Working column
      let workingChecklistHTML = '';
      if (col === 'Working' && card.checklist && card.checklist.length > 0) {
        const tasksHTML = card.checklist.map(task => {
          const taskText = escapeHTML(task.text);
          return `
            <div class="flex items-center gap-2 text-xs mb-1">
              <input class="board-task-checkbox" type="checkbox" data-cardid="${cardId}" data-task="${taskText}" ${task.completed ? 'checked' : ''} />
              <span class="${task.completed ? 'line-through opacity-70 text-on-surface-variant' : 'text-on-surface'}">${taskText}</span>
            </div>
          `;
        }).join('');
        
        workingChecklistHTML = `
          <!-- Inline checklist progress bar -->
          <div class="w-full bg-surface-container-lowest rounded-full h-1 mb-2.5 overflow-hidden">
            <div class="bg-primary h-1 rounded-full" style="width: ${cardProgress}%"></div>
          </div>
          <div class="flex flex-col gap-1 mb-3">
            ${tasksHTML}
          </div>
        `;
      }

      // CI Checks for PR Open
      let prOpenHTML = '';
      if (col === 'PR Open') {
        prOpenHTML = `
          <div class="bg-surface-container-lowest border border-outline-variant rounded p-2 mb-3 flex items-center justify-between">
            <span class="text-[10px] text-on-surface-variant">Manual GitHub follow-up</span>
            <span class="material-symbols-outlined text-tertiary text-[14px] filled-icon">open_in_new</span>
          </div>
        `;
      }

      // Special tags for Merged
      let mergedTextHTML = '';
      if (col === 'Merged') {
        mergedTextHTML = `
          <div class="flex justify-between items-center text-[10px] text-on-surface-variant mt-2">
            <span>Marked complete locally</span>
            <span class="material-symbols-outlined text-tertiary text-[14px]">merge</span>
          </div>
        `;
      }

      // Passed text
      let passedTextHTML = '';
      if (col === 'Passed') {
        passedTextHTML = `
          <div class="flex justify-between items-center text-[10px] text-on-surface-variant mt-2">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[10px]">close</span> Closed / Inactive</span>
          </div>
        `;
      }

      // Navigation arrows inside card
      const leftArrowDisabled = cIdx === 0 ? 'disabled style="opacity:0.3;"' : '';
      const rightArrowDisabled = cIdx === cols.length - 1 ? 'disabled style="opacity:0.3;"' : '';

      return `
        <!-- Card -->
        <div class="kanban-card bg-surface-container border border-outline-variant rounded-lg p-3 cursor-pointer group mb-3 relative board-card-item" data-id="${cardId}">
          <button class="absolute top-2 right-2 text-on-surface-variant hover:text-error bg-transparent border-none delete-card-btn" data-id="${cardId}" style="padding:2px;"><span class="material-symbols-outlined text-[14px]">close</span></button>
          
          <div class="flex justify-between items-start mb-2 pr-4">
            <span class="text-[11px] font-medium text-on-surface-variant uppercase tracking-wide flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px] filled-icon">bookmark</span>
              ${repoName}
            </span>
            <span class="text-xs text-on-surface-variant group-hover:text-primary transition-colors">#${cardNumber}</span>
          </div>
          
          <h4 class="text-sm font-medium text-on-surface leading-snug mb-3 ${col === 'Merged' || closed ? 'line-through opacity-70' : ''}">${cardTitle}</h4>
          
          ${closedWarningHTML}
          ${refreshErrorHTML}
          ${workingChecklistHTML}
          ${prOpenHTML}
          ${mergedTextHTML}
          ${passedTextHTML}
          
          <!-- Card Footer & Direction arrows -->
          <div class="flex justify-between items-center mt-auto pt-2 border-t border-outline-variant/50">
            <span class="text-[10px] text-on-surface-variant">${cardDate}</span>
            
            <div class="flex items-center gap-1">
              <button class="w-6 h-6 rounded bg-surface-container-lowest border border-outline-variant flex items-center justify-center text-xs hover:border-primary move-left-btn" data-id="${cardId}" ${leftArrowDisabled}>
                <span class="material-symbols-outlined text-[14px]">arrow_left</span>
              </button>
              <button class="w-6 h-6 rounded bg-surface-container-lowest border border-outline-variant flex items-center justify-center text-xs hover:border-primary move-right-btn" data-id="${cardId}" ${rightArrowDisabled}>
                <span class="material-symbols-outlined text-[14px]">arrow_right</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!-- Column lane -->
      <div class="kanban-column flex flex-col h-full bg-surface-container-lowest/50 rounded-lg p-3">
        <div class="flex items-center justify-between mb-4 px-1 shrink-0">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full ${dotColor}"></div>
            <h3 class="text-xs font-semibold text-on-surface uppercase tracking-wider">${col}</h3>
            <span class="text-xs font-medium text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline-variant">${cards.length}</span>
          </div>
        </div>
        
        <!-- Cards Viewport -->
        <div class="flex-grow overflow-y-auto pr-1 pb-6 custom-scrollbar board-lane-cards-container" data-lane="${col}">
          ${cardsHTML}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <!-- Kanban Board layout -->
    <section class="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background">
      
      <!-- Board Header Context -->
      <div class="px-6 md:px-8 py-5 border-b border-outline-variant flex-shrink-0 flex flex-col gap-4 md:flex-row md:justify-between md:items-center bg-surface-container-lowest">
        <div class="min-w-0">
          <h1 class="text-2xl font-headline font-bold text-on-surface mb-1">Contribution Board</h1>
          <p class="text-sm text-on-surface-variant">Track saved issues and local contribution decisions across repositories.</p>
        </div>
        
        <div class="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
          <span class="text-xs text-on-surface-variant" id="board-refresh-status">${escapeHTML(store.boardRefreshStatus)}</span>
          <button class="flex items-center gap-2 bg-surface-container border border-outline-variant hover:border-outline text-on-surface text-sm font-medium py-1.5 px-3 rounded transition-all" id="board-refresh-btn" ${totalCards === 0 ? 'disabled style="opacity:0.45;"' : ''}>
            <span class="material-symbols-outlined text-[16px]">sync</span> Refresh saved issues
          </button>
          <button class="flex items-center gap-2 bg-surface-container border border-error/30 hover:border-error text-error text-sm font-medium py-1.5 px-3 rounded transition-all" id="board-clear-btn" ${totalCards === 0 ? 'disabled style="opacity:0.45;"' : ''}>
            <span class="material-symbols-outlined text-[16px]">delete</span> Clear Board
          </button>
        </div>
      </div>
      
      <!-- Scrollable Kanban Area -->
      <div class="flex-1 overflow-x-auto overflow-y-hidden p-6 md:p-8">
        <div class="flex h-full gap-4 items-start pb-4 min-w-max">
          ${columnsHTML}
        </div>
      </div>
    </section>
  `;

  // Bind Lane Card Clicks
  document.querySelectorAll('.board-card-item').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      const cardId = parseInt(card.getAttribute('data-id'), 10);
      const allCards = Object.values(store.boardCards).flat();
      const match = allCards.find(c => c.id === cardId);
      if (match) {
        store.setInspectedIssue(match);
        openInspector();
      }
    });
  });

  // Action Buttons: Delete card
  document.querySelectorAll('.delete-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = parseInt(btn.getAttribute('data-id'), 10);
      store.removeBoardCard(cardId);
    });
  });

  // Move left
  document.querySelectorAll('.move-left-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = parseInt(btn.getAttribute('data-id'), 10);
      store.moveBoardCard(cardId, -1);
    });
  });

  // Move right
  document.querySelectorAll('.move-right-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = parseInt(btn.getAttribute('data-id'), 10);
      store.moveBoardCard(cardId, 1);
    });
  });

  document.querySelectorAll('.move-passed-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = parseInt(btn.getAttribute('data-id'), 10);
      store.moveCardToColumn(cardId, 'Passed');
    });
  });

  // Board Checklist items change state
  document.querySelectorAll('.board-task-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const cardId = parseInt(cb.getAttribute('data-cardid'), 10);
      const taskText = cb.getAttribute('data-task');
      store.toggleTaskChecklist(cardId, taskText, cb.checked);
    });
  });

  const refreshBtn = document.getElementById('board-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('board-refresh-status');
      refreshBtn.disabled = true;
      store.setBoardRefreshStatus('Refreshing saved issues...');
      if (statusEl) statusEl.textContent = 'Refreshing saved issues...';
      await refreshSavedIssuesFromGitHub(statusEl);
    });
  }

  const clearBoardBtn = document.getElementById('board-clear-btn');
  if (clearBoardBtn) {
    clearBoardBtn.addEventListener('click', () => {
      store.clearBoard();
    });
  }
}

/**
 * 4. SETTINGS VIEW
 */
function hiddenItemMatchesFilter(item, filterText) {
  const query = String(filterText || '').trim().toLowerCase();
  if (!query) return true;
  return item.key.toLowerCase().includes(query);
}

function renderHiddenRows(items, type) {
  if (items.length === 0) {
    return `
      <div class="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
        No matching hidden ${type === 'issue' ? 'issues' : 'repositories'}.
      </div>
    `;
  }

  return `
    <div class="divide-y divide-outline-variant/50 overflow-hidden rounded-lg border border-outline-variant">
      ${items.map(item => {
        const typeLabel = type === 'issue' ? 'Issue' : 'Repo';
        const safeKey = escapeHTML(item.key);
        const safeDate = escapeHTML(formatDate(item.hiddenAt));
        const openLinkHTML = item.url
          ? `<a class="text-primary hover:underline text-xs font-medium" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">Open link</a>`
          : '<span class="text-xs text-on-surface-variant">Open unavailable</span>';
        return `
          <div class="grid grid-cols-1 md:grid-cols-[72px_minmax(0,1fr)_120px_auto_auto] items-center gap-3 bg-surface-container-lowest px-4 py-3">
            <span class="w-fit rounded border border-outline-variant bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant">${typeLabel}</span>
            <span class="min-w-0 truncate font-mono text-sm text-on-surface">${safeKey}</span>
            <span class="text-xs text-on-surface-variant">${safeDate}</span>
            ${openLinkHTML}
            <button class="hidden-result-unhide-btn rounded border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:border-on-surface-variant hover:text-on-surface" data-type="${type}" data-key="${safeKey}">
              Unhide
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderHiddenSection(title, type, items, totalMatching) {
  const shown = items.slice(0, HIDDEN_RESULTS_RENDER_LIMIT);
  const overflowHTML = totalMatching > HIDDEN_RESULTS_RENDER_LIMIT
    ? `<p class="mt-2 text-xs text-on-surface-variant">Showing first ${HIDDEN_RESULTS_RENDER_LIMIT} of ${totalMatching.toLocaleString()}. Use search to narrow results.</p>`
    : '';

  return `
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-on-surface">${title}</h3>
        <span class="rounded border border-outline-variant bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">${totalMatching.toLocaleString()}</span>
      </div>
      ${renderHiddenRows(shown, type)}
      ${overflowHTML}
    </section>
  `;
}

function renderHiddenResultsBody(filterText = hiddenSettingsFilter) {
  const hidden = listHiddenItems(localStorage);
  const issues = hidden.issues.filter(item => hiddenItemMatchesFilter(item, filterText));
  const repos = hidden.repos.filter(item => hiddenItemMatchesFilter(item, filterText));
  return `
    ${renderHiddenSection('Issues', 'issue', issues, issues.length)}
    ${renderHiddenSection('Repositories', 'repo', repos, repos.length)}
  `;
}

function renderHiddenResultsManager() {
  const hidden = listHiddenItems(localStorage);
  const issueCount = hidden.issues.length;
  const repoCount = hidden.repos.length;
  return `
    <div class="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
      <div class="p-6 border-b border-outline-variant bg-surface-dim/50">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">visibility_off</span>
              Hidden Results
            </h2>
            <p class="mt-1 text-sm text-on-surface-variant">Review issues and repositories you hid from search results.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span class="rounded border border-outline-variant bg-surface-container-high px-2 py-1 text-xs text-on-surface-variant">${issueCount.toLocaleString()} hidden issues</span>
            <span class="rounded border border-outline-variant bg-surface-container-high px-2 py-1 text-xs text-on-surface-variant">${repoCount.toLocaleString()} hidden repos</span>
          </div>
        </div>
      </div>
      <div class="p-6 space-y-5">
        <input class="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-background placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary" id="hidden-results-filter-input" placeholder="Filter hidden items..." type="search" value="${escapeHTML(hiddenSettingsFilter)}" />
        <div class="space-y-6" id="hidden-results-body">
          ${renderHiddenResultsBody(hiddenSettingsFilter)}
        </div>
      </div>
    </div>
  `;
}

function bindHiddenResultActions() {
  document.querySelectorAll('.hidden-result-unhide-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      const key = btn.getAttribute('data-key');
      if (type && key) {
        store.unhideHiddenItem(type, key);
      }
    });
  });
}

function bindHiddenResultsManager() {
  const filterInput = document.getElementById('hidden-results-filter-input');
  const body = document.getElementById('hidden-results-body');
  if (filterInput && body) {
    filterInput.addEventListener('input', () => {
      hiddenSettingsFilter = filterInput.value;
      body.innerHTML = renderHiddenResultsBody(hiddenSettingsFilter);
      bindHiddenResultActions();
    });
  }
  bindHiddenResultActions();
}

function renderSettings(container) {
  const token = store.githubToken;
  const remember = store.rememberToken;

  container.innerHTML = `
    <!-- Settings Page layout -->
    <section class="p-6 md:p-12">
      <div class="max-w-4xl mx-auto space-y-8">
        
        <header class="space-y-2">
          <h1 class="text-3xl font-headline font-bold tracking-tight text-on-background">Authentication Details</h1>
          <p class="text-on-surface-variant">Configure your access tokens for GitHub integration.</p>
        </header>
        
        <!-- Local Storage Warning Indicator (Only shown when Remember checked) -->
        <div id="settings-storage-warning" class="bg-error-container/10 border border-error/30 rounded-lg p-5 flex items-start gap-4" style="display: ${remember ? 'flex' : 'none'};">
          <span class="material-symbols-outlined text-error mt-0.5">warning</span>
          <div>
            <h3 class="text-sm font-semibold text-error mb-1">Local Browser Security Warning</h3>
            <p class="text-sm text-on-error-container leading-relaxed">
              Stored in this browser. Do not use this on shared machines. localStorage is not secure storage for secrets.
            </p>
          </div>
        </div>
        
        <!-- Default callout explaining limits -->
        <div class="bg-surface-container border border-tertiary/30 rounded-lg p-5 flex items-start gap-4">
          <span class="material-symbols-outlined text-tertiary mt-0.5">lock</span>
          <div>
            <h3 class="text-sm font-semibold text-tertiary mb-1">Local Session Storage by Default</h3>
            <p class="text-sm text-on-secondary-container leading-relaxed">
              We value your secrets. Access tokens are stored temporarily in your session-only memory by default. They are never transmitted to external databases and all API requests are dispatched directly from your browser.
            </p>
          </div>
        </div>
        
        <!-- Configuration Card -->
        <div class="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <div class="p-6 border-b border-outline-variant bg-surface-dim/50">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">key</span>
              GitHub Personal Access Token (PAT)
            </h2>
          </div>
          
          <div class="p-6 space-y-8">
            <!-- Input string -->
            <div class="space-y-3">
              <label class="block text-sm font-medium text-on-surface" for="settings-pat-input">Token Value</label>
              <div class="relative group">
                <input class="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3.5 text-on-background font-mono text-sm focus:outline-none placeholder:text-outline" id="settings-pat-input" placeholder="Paste token for this session" type="password"/>
                <button class="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary" id="toggle-pat-visibility" style="background:none; border:none;">
                  <span class="material-symbols-outlined" id="visibility-icon">visibility</span>
                </button>
              </div>
              
              <div class="flex justify-between items-center text-xs text-on-surface-variant">
                <span>Supports fine-grained or classic developer tokens. No private repository scopes required.</span>
                <a class="text-primary hover:underline flex items-center gap-1" href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">Generate on GitHub <span class="material-symbols-outlined text-[14px]">open_in_new</span></a>
              </div>
            </div>
            
            <!-- Scope checklist showing honest scope mapping -->
            <div class="space-y-4">
              <h3 class="text-sm font-medium text-on-surface">Recommended scopes</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="flex items-start gap-3 p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
                  <div class="w-5 h-5 rounded bg-tertiary/10 border border-tertiary/30 flex items-center justify-center text-tertiary">
                    <span class="material-symbols-outlined text-[14px] filled-icon">check</span>
                  </div>
                  <div>
                    <div class="font-mono text-sm text-on-surface mb-0.5">public_repo (optional)</div>
                    <div class="text-xs text-on-surface-variant">Read public repositories to search active issues.</div>
                  </div>
                </div>
                <div class="flex items-start gap-3 p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
                  <div class="w-5 h-5 rounded bg-tertiary/10 border border-tertiary/30 flex items-center justify-center text-tertiary">
                    <span class="material-symbols-outlined text-[14px] filled-icon">check</span>
                  </div>
                  <div>
                    <div class="font-mono text-sm text-on-surface mb-0.5">no private scopes needed</div>
                    <div class="text-xs text-on-surface-variant">Do not check full private repo scopes unless necessary.</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Remember token option -->
            <label class="flex items-start gap-3 p-4 rounded-lg border border-outline-variant bg-surface-container-lowest cursor-pointer hover:border-primary/30 transition-colors">
              <input class="mt-0.5" id="settings-remember-checkbox" type="checkbox" ${remember ? 'checked' : ''} />
              <div>
                <span class="text-sm font-semibold text-on-surface block">Remember token locally</span>
                <span class="text-xs text-on-surface-variant mt-1 block leading-relaxed">Save token within browser local storage. Useful to avoid pasting token repeatedly. Displays a security banner as it is stored in cleartext.</span>
              </div>
            </label>
            
            <!-- Status message container -->
            <div id="settings-connection-status" style="display:none;"></div>
            
            <!-- Actions -->
            <div class="pt-4 flex justify-end gap-4">
              <button class="px-6 py-2.5 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container transition-colors font-medium text-sm" id="test-connection-btn">
                Test Connection
              </button>
              <button class="px-6 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-medium text-sm" id="save-settings-btn">
                Save Configuration
              </button>
            </div>
            
          </div>
        </div>
        
        ${renderHiddenResultsManager()}

        <!-- Danger Zone -->
        <div class="pt-8 border-t border-outline-variant space-y-4">
          <h3 class="text-sm font-semibold text-error uppercase tracking-wider">Danger Zone</h3>
          <div class="flex items-center justify-between p-5 rounded-lg border border-error/20 bg-error-container/10">
            <div>
              <div class="font-medium text-on-surface mb-1">Clear token and settings</div>
              <div class="text-sm text-on-surface-variant">Remove the token, remember-token setting, and connection state. Board cards are kept.</div>
            </div>
            <button class="px-4 py-2 rounded-lg border border-error text-error hover:bg-error-container/50 transition-colors font-medium text-sm whitespace-nowrap" id="clear-token-settings-btn">
              Clear Token/Settings
            </button>
          </div>
          <div class="flex items-center justify-between p-5 rounded-lg border border-error/20 bg-error-container/10">
            <div>
              <div class="font-medium text-on-surface mb-1">Clear board data</div>
              <div class="text-sm text-on-surface-variant">Remove saved issue cards and local board progress. Token settings are kept.</div>
            </div>
            <button class="px-4 py-2 rounded-lg border border-error text-error hover:bg-error-container/50 transition-colors font-medium text-sm whitespace-nowrap" id="clear-board-settings-btn">
              Clear Board
            </button>
          </div>
          <div class="flex items-center justify-between p-5 rounded-lg border border-error/20 bg-error-container/10">
            <div>
              <div class="font-medium text-on-surface mb-1">Clear hidden items</div>
              <div class="text-sm text-on-surface-variant">Show previously hidden issues and repositories in future results.</div>
            </div>
            <button class="px-4 py-2 rounded-lg border border-error text-error hover:bg-error-container/50 transition-colors font-medium text-sm whitespace-nowrap" id="clear-hidden-settings-btn">
              Clear Hidden
            </button>
          </div>
          <div class="flex items-center justify-between p-5 rounded-lg border border-error/20 bg-error-container/10">
            <div>
              <div class="font-medium text-on-surface mb-1">Clear all app data</div>
              <div class="text-sm text-on-surface-variant">Remove token/settings and saved board data from this browser.</div>
            </div>
            <button class="px-4 py-2 rounded-lg border border-error text-error hover:bg-error-container/50 transition-colors font-medium text-sm whitespace-nowrap" id="clear-all-settings-btn">
              Clear All
            </button>
          </div>
        </div>
        
      </div>
    </section>
  `;

  // Bind actions
  const patInput = document.getElementById('settings-pat-input');
  const rememberCheckbox = document.getElementById('settings-remember-checkbox');
  const warningBanner = document.getElementById('settings-storage-warning');
  if (patInput) {
    patInput.value = token;
  }
  bindHiddenResultsManager();

  // Interactive toggle check box warning display
  if (rememberCheckbox && warningBanner) {
    rememberCheckbox.addEventListener('change', () => {
      warningBanner.style.display = rememberCheckbox.checked ? 'flex' : 'none';
    });
  }

  // Eye visibility toggling
  const visibilityToggle = document.getElementById('toggle-pat-visibility');
  const visibilityIcon = document.getElementById('visibility-icon');
  if (visibilityToggle && patInput && visibilityIcon) {
    visibilityToggle.addEventListener('click', () => {
      if (patInput.type === 'password') {
        patInput.type = 'text';
        visibilityIcon.textContent = 'visibility_off';
      } else {
        patInput.type = 'password';
        visibilityIcon.textContent = 'visibility';
      }
    });
  }

  // Save Settings
  const saveBtn = document.getElementById('save-settings-btn');
  if (saveBtn && patInput && rememberCheckbox) {
    saveBtn.addEventListener('click', () => {
      const tokVal = patInput.value.trim();
      const remVal = rememberCheckbox.checked;
      store.updateToken(tokVal, remVal);

      // Show temporary save feedback
      const statusDiv = document.getElementById('settings-connection-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.className = 'p-3.5 rounded bg-tertiary/10 border border-tertiary/30 text-tertiary text-xs';
        statusDiv.textContent = `Token saved! Current rate-limit thresholds cleared. Retention mode set to: ${remVal ? 'Persistent localStorage' : 'Session Memory'}`;
      }
    });
  }

  // Connection tester
  const testBtn = document.getElementById('test-connection-btn');
  if (testBtn && patInput) {
    testBtn.addEventListener('click', async () => {
      const tokVal = patInput.value.trim();
      const statusDiv = document.getElementById('settings-connection-status');
      
      if (!tokVal) {
        statusDiv.style.display = 'block';
        statusDiv.className = 'p-3.5 rounded bg-error-container/10 border border-error/20 text-error text-xs';
        statusDiv.textContent = "Please provide a token string value before attempting tests.";
        return;
      }

      statusDiv.style.display = 'block';
      statusDiv.className = 'p-3.5 rounded bg-surface-container border border-outline-variant text-on-surface-variant text-xs';
      statusDiv.textContent = "Testing connection with GitHub User API /user...";

      try {
        const res = await fetch('https://api.github.com/user', createGitHubRequestOptions('https://api.github.com/user', tokVal));

        if (res.ok) {
          const userObj = await res.json();
          statusDiv.className = 'p-3.5 rounded bg-tertiary/10 border border-tertiary/30 text-tertiary text-xs flex items-center gap-2';
          statusDiv.textContent = `Connection active! Welcome, ${userObj.login || 'GitHub user'} (Rate limits verified).`;
          
          // Update avatar initial initials dynamically based on username
          const initials = String(userObj.login || 'GH').slice(0, 2).toUpperCase();
          const avatarInitial = document.getElementById('user-avatar-initials');
          if (avatarInitial) avatarInitial.textContent = initials;
          
        } else {
          throw new Error(`Auth test rejected: ${res.statusText} (${res.status})`);
        }
      } catch (e) {
        statusDiv.className = 'p-3.5 rounded bg-error-container/10 border border-error/20 text-error text-xs flex items-center gap-2';
        statusDiv.textContent = `Connection failed: ${e.message}. Double check credentials.`;
      }
    });
  }

  // Clear data settings
  const clearTokenBtn = document.getElementById('clear-token-settings-btn');
  if (clearTokenBtn) {
    clearTokenBtn.addEventListener('click', () => {
      store.clearToken();
      if (patInput) patInput.value = '';
      if (rememberCheckbox) rememberCheckbox.checked = false;
      if (warningBanner) warningBanner.style.display = 'none';

      const statusDiv = document.getElementById('settings-connection-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.className = 'p-3.5 rounded bg-error-container/10 border border-error/20 text-error text-xs';
        statusDiv.textContent = "Token wiped permanently from browser store. Rate limits set back to public thresholds.";
      }
      
      const avatarInitial = document.getElementById('user-avatar-initials');
      if (avatarInitial) avatarInitial.textContent = 'JD';
    });
  }

  const clearBoardBtn = document.getElementById('clear-board-settings-btn');
  if (clearBoardBtn) {
    clearBoardBtn.addEventListener('click', () => {
      store.clearBoard();
      const statusDiv = document.getElementById('settings-connection-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.className = 'p-3.5 rounded bg-error-container/10 border border-error/20 text-error text-xs';
        statusDiv.textContent = "Board data removed. Token settings were kept.";
      }
    });
  }

  const clearHiddenBtn = document.getElementById('clear-hidden-settings-btn');
  if (clearHiddenBtn) {
    clearHiddenBtn.addEventListener('click', () => {
      hiddenSettingsFilter = '';
      store.clearHiddenItems();
      const statusDiv = document.getElementById('settings-connection-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.className = 'p-3.5 rounded bg-error-container/10 border border-error/20 text-error text-xs';
        statusDiv.textContent = "Hidden issues and repositories cleared. New renders will show normal results.";
      }
    });
  }

  const clearAllBtn = document.getElementById('clear-all-settings-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      hiddenSettingsFilter = '';
      store.clearAllLocalData();
      if (patInput) patInput.value = '';
      if (rememberCheckbox) rememberCheckbox.checked = false;
      if (warningBanner) warningBanner.style.display = 'none';
      const statusDiv = document.getElementById('settings-connection-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.className = 'p-3.5 rounded bg-error-container/10 border border-error/20 text-error text-xs';
        statusDiv.textContent = "All PR-Dashboard local app data removed from this browser.";
      }
    });
  }
}

/**
 * 5. DETAILS INSPECTOR DRAW PANEL VIEW
 */
function openInspector() {
  const panel = document.getElementById('inspector-overlay-drawer');
  if (!panel) return;

  const issue = store.inspectedIssue;
  if (!issue) return;

  const fitObj = calculateFitScore(issue);
  const { score } = fitObj;
  const rating = getFitScoreRating(score);
  const contributionBrief = buildContributionBrief(issue, fitObj);
  const inspectorBestFitLabel = getInspectorBestFitLabel(contributionBrief.bestFor);
  const repoName = escapeHTML(issue.repository?.full_name || issue.repository?.name || 'github');
  const saved = Object.values(store.boardCards).flat().some(c => c.id === issue.id);
  const safeIssueTitle = escapeHTML(issue.title);
  const safeIssueLanguage = escapeHTML(issue.repository?.language || 'Code');
  const safeIssueNumber = safeInteger(issue.number);
  const safeIssueUser = escapeHTML(issue.user ? issue.user.login : 'anonymous');
  const safeIssueDate = escapeHTML(formatDate(issue.updated_at));
  const safeIssueState = escapeHTML(issue.state || 'Open');
  const safeIssueBody = escapeHTML(issue.body || 'No detailed issue summary description offered.');
  const safeIssueUrl = getSafeIssueHtmlUrl(issue);
  const safeProgress = safePercent(issue.progress || 0);
  const closed = isClosedIssue(issue);
  const riskyContribution = !fitObj.isContributionCandidate;
  const closedInspectorHTML = closed ? `
    <div class="rounded-lg border border-error/25 bg-error-container/10 p-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-sm font-semibold text-error mb-1">This issue is closed</h3>
        <p class="text-sm text-on-surface-variant">GitHub reports this issue as closed${issue.state_reason ? ` (${escapeHTML(issue.state_reason)})` : ''}${issue.closed_at ? ` since ${escapeHTML(formatDate(issue.closed_at))}` : ''}. Treat it as inactive, not an active candidate.</p>
      </div>
      <button class="px-3 py-2 rounded border border-error text-error text-xs font-medium hover:bg-error-container/30" id="inspector-move-passed-btn">Move to Passed</button>
    </div>
  ` : '';
  const riskyLookupHTML = !closed && riskyContribution ? `
    <div class="rounded-lg border border-error/25 bg-error-container/10 p-4 flex items-start gap-3">
      <span class="material-symbols-outlined text-error mt-0.5">warning</span>
      <div>
        <h3 class="text-sm font-semibold text-error mb-1">Not a contribution candidate</h3>
        <p class="text-sm text-on-surface-variant">This can still be saved for tracking, but the score flags it as a likely pass.</p>
      </div>
    </div>
  ` : '';

  // Render match score explanations
  const fitScoreReasonsHTML = fitObj.rows.map(row => {
    const signed = `${row.points >= 0 ? '+' : ''}${row.points}`;
    const tone = row.points >= 0 ? 'text-tertiary' : 'text-error';
    return `
      <li class="flex items-start gap-2 text-sm text-on-surface-variant">
        <span class="font-mono text-xs ${tone} min-w-8">${escapeHTML(signed)}</span>
        <span>${escapeHTML(row.label)}</span>
      </li>
    `;
  }).join('');
  const passChipsHTML = fitObj.passReasons.length ? `
    <div class="mt-4 flex flex-wrap gap-2">
      ${fitObj.passReasons.map(reason => `<span class="rounded-full border border-error/25 bg-error-container/10 px-2 py-0.5 text-[11px] text-error">${escapeHTML(reason)}</span>`).join('')}
    </div>
  ` : '';
  const briefVerdictTone = contributionBrief.verdict === 'Good candidate'
    ? 'border-tertiary/25 bg-tertiary/10 text-tertiary'
    : contributionBrief.verdict === 'Likely pass'
      ? 'border-error/25 bg-error-container/10 text-error'
      : 'border-outline-variant bg-surface-container-high text-on-surface-variant';
  const briefBestForTone = contributionBrief.bestFor === 'Skip'
    ? 'border-error/25 bg-error-container/10 text-error'
    : 'border-primary/20 bg-primary/10 text-primary';
  const contributionBriefWhyHTML = contributionBrief.why.map(reason => `
    <li class="flex items-start gap-2 text-sm text-on-surface-variant">
      <span class="material-symbols-outlined text-tertiary text-[14px] mt-0.5">check_circle</span>
      <span>${escapeHTML(reason)}</span>
    </li>
  `).join('');
  const contributionBriefRisksHTML = contributionBrief.risks.map(risk => `
    <li class="flex items-start gap-2 text-sm text-on-surface-variant">
      <span class="material-symbols-outlined text-error text-[14px] mt-0.5">error</span>
      <span>${escapeHTML(risk)}</span>
    </li>
  `).join('');
  const maintainerQuestionHTML = contributionBrief.maintainerQuestion ? `
    <div class="mt-4 rounded border border-primary/20 bg-primary/5 p-3">
      <div class="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">Suggested maintainer question</div>
      <p class="text-sm text-on-surface-variant">${escapeHTML(contributionBrief.maintainerQuestion)}</p>
    </div>
  ` : '';

  // Checklist Action plan
  const checklist = issue.checklist || [];
  const actionPlanHTML = checklist.map(task => {
    const taskText = escapeHTML(task.text);
    return `
      <label class="flex items-start gap-3 cursor-pointer group">
        <input class="mt-0.5 inspector-task-checkbox" type="checkbox" data-task="${taskText}" ${task.completed ? 'checked' : ''} />
        <span class="text-sm text-on-surface-variant group-hover:text-on-background transition-colors ${task.completed ? 'line-through opacity-70' : ''}">${taskText}</span>
      </label>
    `;
  }).join('');

  panel.innerHTML = `
    <!-- Sticky Header -->
    <div class="sticky top-0 bg-surface-dim/95 backdrop-blur-md border-b border-outline-variant p-6 z-20 flex justify-between items-start shrink-0">
      <div class="max-w-2xl">
        <div class="flex items-center flex-wrap gap-2 mb-3">
          <span class="px-2 py-0.5 text-xs font-mono font-medium rounded-sm bg-primary/10 text-primary border border-primary/20">${safeIssueLanguage}</span>
          <span class="px-2 py-0.5 text-xs font-mono font-medium rounded-sm border ${rating.bgClass}">${rating.rating}</span>
          <span class="text-xs text-on-surface-variant font-mono">${repoName} #${safeIssueNumber}</span>
        </div>
        <h2 class="text-2xl font-headline font-bold text-on-background tracking-tighter leading-tight">${safeIssueTitle}</h2>
        <div class="flex items-center gap-4 mt-4 text-xs text-on-surface-variant">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]">account_circle</span>
            <span>Opened by <strong class="text-on-background">${safeIssueUser}</strong></span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]">schedule</span>
            <span>Updated ${safeIssueDate}</span>
          </div>
          <div class="flex items-center gap-1.5 ${closed ? 'text-error' : 'text-tertiary'}">
            <span class="material-symbols-outlined text-[18px] filled-icon">${closed ? 'cancel' : 'check_circle'}</span>
            <span>${safeIssueState}</span>
          </div>
        </div>
      </div>
      
      <button class="text-on-surface-variant hover:text-primary border border-outline-variant rounded p-1 flex items-center justify-center bg-surface" id="inspector-close-btn" style="background:none;">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    
    <!-- Scrollable Content Viewport -->
    <div class="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
      
      <!-- Actions buttons inside details -->
      <div class="flex gap-3 bg-surface-container/50 p-4 border border-outline-variant rounded-lg shrink-0 justify-between items-center">
        <span class="text-xs text-on-surface-variant">Action center</span>
        <div class="flex gap-2">
          <button class="px-4 py-2 rounded text-xs font-medium flex items-center gap-1.5 ${saved ? 'bg-tertiary/10 text-tertiary border border-tertiary/30' : 'bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high'}" id="inspector-save-issue-btn">
            <span class="material-symbols-outlined text-[16px]">${saved ? 'check' : 'bookmark'}</span>
            ${saved ? 'Saved to board' : 'Save issue'}
          </button>
          <button class="px-4 py-2 rounded text-xs font-medium flex items-center gap-1.5 bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" id="inspector-hide-issue-btn">
            <span class="material-symbols-outlined text-[16px]">visibility_off</span>
            Hide issue
          </button>
          <button class="px-4 py-2 rounded text-xs font-medium flex items-center gap-1.5 bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" id="inspector-hide-repo-btn">
            <span class="material-symbols-outlined text-[16px]">folder_off</span>
            Hide repo
          </button>
          
          ${safeIssueUrl ? `<a class="px-4 py-2 bg-primary text-on-primary rounded text-xs font-medium hover:bg-primary-container transition-colors flex items-center gap-1.5" href="${escapeHTML(safeIssueUrl)}" target="_blank" rel="noopener noreferrer">
            Open on GitHub
            <span class="material-symbols-outlined text-[16px]">open_in_new</span>
          </a>` : '<span class="px-4 py-2 rounded text-xs font-medium border border-outline-variant text-on-surface-variant">GitHub link unavailable</span>'}
        </div>
      </div>

      <!-- Description Block -->
      ${closedInspectorHTML}
      ${riskyLookupHTML}
      <section class="bg-surface-container rounded-lg border border-outline-variant p-5">
        <h3 class="text-base font-headline font-semibold text-on-background mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">description</span>
          Issue Description
        </h3>
        <div class="prose prose-invert text-xs text-on-surface-variant font-body leading-relaxed whitespace-pre-wrap select-text">${safeIssueBody}</div>
      </section>
      
      <!-- Fit Details & Analytics Bento -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">

        <!-- Contribution Coach Brief -->
        <div class="bg-surface-container rounded-lg border border-outline-variant p-4 md:col-span-2">
          <h4 class="text-xs font-headline font-semibold text-on-background mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[18px]">assistant_direction</span>
            Contribution Brief
          </h4>
          <div class="mb-4 flex flex-wrap gap-2">
            <span class="rounded border ${briefVerdictTone} px-2 py-0.5 text-xs">Verdict: ${escapeHTML(contributionBrief.verdict)}</span>
            <span class="rounded border ${briefBestForTone} px-2 py-0.5 text-xs">Best fit: ${escapeHTML(inspectorBestFitLabel)}</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div class="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant mb-2">Why</div>
              <ul class="space-y-2">
                ${contributionBriefWhyHTML}
              </ul>
            </div>
            <div>
              <div class="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant mb-2">Risks</div>
              <ul class="space-y-2">
                ${contributionBriefRisksHTML}
              </ul>
            </div>
          </div>
          <div class="mt-4 border-t border-outline-variant/40 pt-3">
            <div class="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant mb-1">First move</div>
            <p class="text-sm text-on-surface">${escapeHTML(contributionBrief.firstMove)}</p>
          </div>
          ${maintainerQuestionHTML}
        </div>
        
        <!-- Score Fit Analysis -->
        <div class="bg-surface-container rounded-lg border border-outline-variant p-4 relative overflow-hidden group">
          <h4 class="text-xs font-headline font-semibold text-on-background mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[18px]">radar</span>
            Why this score?
          </h4>
          <ul class="space-y-2">
            ${fitScoreReasonsHTML}
          </ul>
          ${passChipsHTML}
        </div>
        
        <!-- Action Plan Action checklist -->
        <div class="bg-surface-container rounded-lg border border-outline-variant p-4">
          <h4 class="text-xs font-headline font-semibold text-on-background mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[18px]">rule</span>
            Action Plan
          </h4>
          <div class="space-y-2.5">
            ${actionPlanHTML}
          </div>
          
          <!-- Progress stats if the card is in board -->
          ${saved ? `
            <div class="mt-4 pt-3 border-t border-outline-variant/30">
              <div class="flex justify-between items-center text-[10px] text-on-surface-variant mb-1">
                <span>Interactive Progress</span>
                <span>${safeProgress}%</span>
              </div>
              <div class="w-full bg-surface-container-lowest rounded-full h-1 overflow-hidden">
                <div class="bg-primary h-1 rounded-full" style="width: ${safeProgress}%"></div>
              </div>
            </div>
          ` : ''}
        </div>
        
      </div>
      
    </div>
  `;

  // Display drawer panel
  panel.style.display = 'flex';
  setTimeout(() => {
    panel.classList.remove('translate-x-full');
  }, 20);

  // Bind close
  const closeBtn = document.getElementById('inspector-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeInspector);
  }

  // Click outside to close drawer
  // Render details action save
  const saveBtn = document.getElementById('inspector-save-issue-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (riskyContribution && saveBtn.getAttribute('data-confirm-risk') !== 'true') {
        saveBtn.setAttribute('data-confirm-risk', 'true');
        saveBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">warning</span> Save anyway?`;
        saveBtn.classList.add('bg-error-container/10', 'text-error', 'border-error/30');
        return;
      }
      store.saveIssueToBoard(issue);
      saveBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">check</span> Saved to board`;
      saveBtn.classList.add('bg-tertiary/10', 'text-tertiary', 'border-tertiary/30');
      saveBtn.classList.remove('bg-surface-container', 'border-outline-variant', 'text-on-surface');
      // Trigger a re-render of active screen (Find Issues cards list or Dashboard) to reflect Saved status
      renderActiveScreen();
    });
  }

  const hideIssueBtn = document.getElementById('inspector-hide-issue-btn');
  if (hideIssueBtn) {
    hideIssueBtn.addEventListener('click', () => {
      closeInspector();
      store.hideIssue(issue);
    });
  }

  const hideRepoBtn = document.getElementById('inspector-hide-repo-btn');
  if (hideRepoBtn) {
    hideRepoBtn.addEventListener('click', () => {
      closeInspector();
      store.hideRepo(issue);
    });
  }

  const movePassedBtn = document.getElementById('inspector-move-passed-btn');
  if (movePassedBtn) {
    movePassedBtn.addEventListener('click', () => {
      store.moveCardToColumn(issue.id, 'Passed');
      closeInspector();
    });
  }

  // Checkbox toggle inside action plan
  document.querySelectorAll('.inspector-task-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const taskText = cb.getAttribute('data-task');
      store.toggleTaskChecklist(issue.id, taskText, cb.checked);
      // Re-open inspector to refresh visual checks or update progress
      openInspector();
    });
  });
}

function closeInspector() {
  const panel = document.getElementById('inspector-overlay-drawer');
  if (!panel) return;

  panel.classList.add('translate-x-full');
  setTimeout(() => {
    panel.style.display = 'none';
    store.setInspectedIssue(null);
  }, 300);
}
