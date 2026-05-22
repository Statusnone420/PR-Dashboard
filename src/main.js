import { store } from './state/store.js';
import { buildQueryPreview, createGitHubRequestOptions, fetchExactIssue, fetchIssueMetadataForRefresh, searchGitHubIssues } from './api/github.js';
import { screenFromHash } from './routing.js';
import { applyFilterPatch, applyPresetSearch, getRelaxedFilters } from './searchInteractions.js';
import { escapeHTML, formatDate, getSafeGitHubAvatarUrl, getSafeIssueHtmlUrl, safeInteger, safePercent } from './security.js';
import { isClosedIssue, markIssueMetadataUnchanged, mergeIssueMetadata } from './boardModel.js';
import { ACTIVE_BOARD_COLUMNS, BOARD_COLUMNS, BOARD_LAYOUT_MAX_WIDTH, COMPLETED_BOARD_COLUMNS } from './boardConstants.js';
import { buildExactIssueApiUrl, parseExactLookupInput } from './lookup.js';
import { calculateMatchScore, getMatchScoreRating } from './matchScore.js';
import { getDashboardHeroRecommendation, getDashboardSavedPreviewCards } from './dashboardHero.js';
import { buildContributionBrief } from './contributionBrief.js';
import { filterHiddenIssues, isIssueHidden, isRepoHidden, listHiddenItems } from './hiddenItems.js';
import { REVIEW_FLOW_COLORS, summarizeReviewFlow } from './dashboardReviewFlow.js';
import { getCanonicalIssueKey, getCanonicalRepoKey } from './issueKeys.js';
import { exportLocalData, importLocalData } from './localData.js';
import { buildLocalAlerts } from './localAlerts.js';
import { isGitHubActivityVisible } from './githubActivity.js';
import { getProfileInitials } from './profile.js';
import { listProofEntries } from './proofLog.js';
import {
  getActiveBoardRefreshRequestCount,
  getBatchRefreshWarning,
  getSafeRefreshErrorMessage,
  getStaleBoardRefreshEntries,
  getStaleBoardRefreshRequestCount,
  getStaleBoardRefreshTotalCount,
  refreshActiveBoardCardsSerially,
  shouldConfirmBatchRefresh
} from './boardRefresh.js';

const HIDDEN_RESULTS_RENDER_LIMIT = 100;
const ACTIVE_REVIEW_COLUMNS = ACTIVE_BOARD_COLUMNS;
const RESOLVED_BOARD_COLUMNS = COMPLETED_BOARD_COLUMNS;
let hiddenSettingsFilter = '';
let localAlertsOpen = false;
let inspectorRefreshStatus = '';
let inspectorRefreshStatusCardId = null;

// Initialize SPA
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupGlobalSearch();
  store.currentScreen = screenFromHash(window.location.hash);
  
  // Initial render
  updateHeaderProfile();
  renderActiveScreen();
  updateSidebarActiveState(store.currentScreen);

  // Subscribe UI to store changes
  store.subscribe((state) => {
    updateRateLimitBadge(state.rateLimit);
    updateHeaderProfile();
    renderLocalAlertsPopover();
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

function isIssueSavedToBoard(issue) {
  return Boolean(findSavedBoardCard(issue));
}

function findSavedBoardCard(issue) {
  const issueKey = getCanonicalIssueKey(issue);
  return Object.values(store.boardCards).flat().find(card => {
    const cardKey = getCanonicalIssueKey(card);
    return (issueKey && cardKey === issueKey) || card.id === issue?.id;
  });
}

function getSearchItemsForActions() {
  const items = store.searchResults || [];
  return store.lastSearchMode === 'lookup' ? items : filterHiddenIssues(items);
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
      if (window.location.hash !== '#profile') {
        window.location.hash = 'profile';
      } else {
        store.setScreen('profile');
      }
    });
  }

  const notificationsBtn = document.getElementById('btn-notifications');
  if (notificationsBtn) {
    notificationsBtn.addEventListener('click', () => {
      localAlertsOpen = !localAlertsOpen;
      renderLocalAlertsPopover();
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

function renderAvatarInitialsContent(initials, options = {}) {
  const idAttribute = options.includeInitialsId ? ' id="user-avatar-initials"' : '';
  return `<div class="w-full h-full bg-primary-container flex items-center justify-center text-xs font-bold text-on-primary-container"${idAttribute}>${escapeHTML(initials)}</div>`;
}

function renderProfileAvatarContent(profile, options = {}) {
  const initials = getProfileInitials(profile);
  const safeAvatarUrl = getSafeGitHubAvatarUrl(profile?.avatar_url);
  if (!safeAvatarUrl) {
    return renderAvatarInitialsContent(initials, options);
  }

  const altName = profile?.login || profile?.name || 'GitHub user';
  const fallbackId = options.includeInitialsId ? ' data-avatar-fallback-id="user-avatar-initials"' : '';
  return `
    <img
      class="h-full w-full object-cover"
      src="${escapeHTML(safeAvatarUrl)}"
      alt="GitHub avatar for ${escapeHTML(altName)}"
      referrerpolicy="no-referrer"
      loading="lazy"
      decoding="async"
      data-avatar-fallback="${escapeHTML(initials)}"${fallbackId}
    />
  `;
}

function renderProfileAvatarFrame(profile, className, options = {}) {
  return `<div class="${className}">${renderProfileAvatarContent(profile, options)}</div>`;
}

function bindAvatarFallbacks(root = document) {
  root.querySelectorAll('img[data-avatar-fallback]').forEach(img => {
    img.addEventListener('error', () => {
      const initials = img.getAttribute('data-avatar-fallback') || 'GH';
      const fallbackId = img.getAttribute('data-avatar-fallback-id');
      const container = img.parentElement;
      if (container) {
        container.innerHTML = renderAvatarInitialsContent(initials, { includeInitialsId: fallbackId === 'user-avatar-initials' });
      }
    }, { once: true });
  });
}

function updateHeaderProfile() {
  const avatar = document.getElementById('user-profile-avatar');
  if (avatar) {
    avatar.innerHTML = renderProfileAvatarContent(store.profile, { includeInitialsId: true });
    bindAvatarFallbacks(avatar);
  }
}

function renderLocalAlertsPopover() {
  const existing = document.getElementById('local-alerts-popover');
  if (existing) existing.remove();
  const button = document.getElementById('btn-notifications');
  if (!button) return;

  const alerts = buildLocalAlerts(store.boardCards);
  button.classList.toggle('text-primary', alerts.length > 0);
  button.title = alerts.length ? `${alerts.length} Review reminders` : 'Review reminders';
  if (!localAlertsOpen) return;

  const popover = document.createElement('div');
  popover.id = 'local-alerts-popover';
  popover.className = 'fixed right-4 top-16 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-outline-variant bg-surface p-4 shadow-2xl';
  const alertsHTML = alerts.length
    ? alerts.slice(0, 8).map(alert => `
        <div class="interactive-row w-full rounded border border-outline-variant bg-surface-container-lowest p-3 text-left text-sm local-alert-row" data-card-id="${escapeHTML(String(alert.cardId || ''))}">
          <div class="mb-1 flex items-center justify-between gap-3">
            <span class="font-medium text-on-surface">${escapeHTML(alert.title)}</span>
            <span class="text-[10px] uppercase tracking-wide text-primary">${escapeHTML(alert.column)}</span>
          </div>
          <p class="text-xs text-on-surface-variant">${escapeHTML(alert.message)}</p>
          ${alert.kind === 'github-activity' ? `
            <button class="action-button mt-2 px-2 py-1 text-[11px] mark-activity-reviewed-btn" data-id="${escapeHTML(String(alert.cardId || ''))}">
              Mark reviewed
            </button>
          ` : ''}
        </div>
      `).join('')
    : '<div class="rounded border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">No review reminders right now.</div>';

  popover.innerHTML = `
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-on-surface">Review reminders</h2>
      <button class="action-button h-7 w-7 p-0 text-xs" id="local-alerts-close-btn"><span class="material-symbols-outlined text-[16px]">close</span></button>
    </div>
    <p class="mb-3 text-xs text-on-surface-variant">Review reminders are generated from your local board state and manual refreshes.</p>
    <div class="space-y-2">${alertsHTML}</div>
  `;
  document.body.appendChild(popover);

  const closeBtn = document.getElementById('local-alerts-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      localAlertsOpen = false;
      renderLocalAlertsPopover();
    });
  }
  popover.querySelectorAll('.local-alert-row').forEach(row => {
    row.addEventListener('click', () => {
      const cardId = Number.parseInt(row.getAttribute('data-card-id'), 10);
      const card = Object.values(store.boardCards).flat().find(item => item.id === cardId);
      if (card) {
        store.setInspectedIssue(card);
        openInspector();
      }
    });
  });
  popover.querySelectorAll('.mark-activity-reviewed-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const cardId = Number.parseInt(btn.getAttribute('data-id'), 10);
      store.markGitHubActivityReviewed(cardId);
      renderLocalAlertsPopover();
      renderActiveScreen();
    });
  });
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
    case 'profile':
      renderProfile(container);
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
function getBoardEntriesByColumn(boardCardsByColumn) {
  return BOARD_COLUMNS.flatMap(column => (boardCardsByColumn[column] || []).map(card => ({ column, card })));
}

function countBoardEntries(entries, predicate) {
  return entries.filter(predicate).length;
}

function progressPercent(part, total) {
  if (!total) return 0;
  return safePercent(Math.round((part / total) * 100));
}

function renderMetricProgress(percent, label = '') {
  const safeWidth = safePercent(percent);
  const labelAttribute = label ? ` aria-label="${escapeHTML(label)}"` : '';
  return `
    <div class="metric-progress-track"${labelAttribute}>
      <span class="metric-progress-fill" style="width: ${safeWidth}%"></span>
    </div>
  `;
}

function renderBoardFlow(reviewFlow) {
  if (!reviewFlow.total) {
    return '<p class="text-xs text-on-surface-variant">Save candidates to start tracking board flow.</p>';
  }

  const segmentsHTML = reviewFlow.lanes.map(lane => {
    const width = safePercent(lane.percent);
    const safeColumn = escapeHTML(lane.column);
    const color = REVIEW_FLOW_COLORS[lane.column] || 'rgba(167, 139, 250, 0.9)';
    return `<span class="review-flow-segment metric-progress-fill" data-review-flow-lane="${safeColumn}" style="width: ${width}%; background: ${color};" title="${safeColumn}: ${lane.count}"></span>`;
  }).join('');

  const lanesHTML = reviewFlow.lanes.map(lane => {
    const safeColumn = escapeHTML(lane.column);
    const safeNextMove = escapeHTML(lane.nextMove);
    const color = REVIEW_FLOW_COLORS[lane.column] || 'rgba(167, 139, 250, 0.9)';
    return `
      <button class="review-flow-chip interactive-chip rounded px-2 py-1 text-[11px] text-on-surface-variant" type="button" data-review-flow-lane="${safeColumn}" data-review-flow-next="${safeNextMove}">
        <span class="h-1.5 w-1.5 rounded-full" style="background: ${color}"></span>
        ${safeColumn} ${lane.count}
      </button>
    `;
  }).join('');

  return `
    <div class="review-flow-group space-y-3">
      <div class="text-sm font-semibold text-on-surface">${escapeHTML(reviewFlow.headline)}</div>
      <div class="metric-progress-track flex">${segmentsHTML}</div>
      <div class="flex flex-wrap gap-2">${lanesHTML}</div>
      <p class="text-xs text-on-surface-variant" id="board-flow-next-move">${escapeHTML(reviewFlow.nextMove)}</p>
    </div>
  `;
}

function renderDashboard(container) {
  // Grab dynamic data
  const boardEntries = getBoardEntriesByColumn(store.boardCards);
  const boardCards = boardEntries.map(entry => entry.card);
  const closedCards = boardCards.filter(isClosedIssue);
  const activeCards = boardCards.filter(card => !isClosedIssue(card));
  const dashboardSavedCards = activeCards.length ? activeCards : boardCards;
  const totalSavedCount = boardCards.length;
  const activeReviewCount = countBoardEntries(boardEntries, entry => ACTIVE_REVIEW_COLUMNS.includes(entry.column) && !isClosedIssue(entry.card));
  const resolvedOrPassedCount = countBoardEntries(boardEntries, entry => RESOLVED_BOARD_COLUMNS.includes(entry.column) || isClosedIssue(entry.card));
  const hiddenItems = listHiddenItems(localStorage);
  const hiddenIssueCount = hiddenItems.issues.length;
  const hiddenRepoCount = hiddenItems.repos.length;
  const hiddenTotalCount = hiddenIssueCount + hiddenRepoCount;
  const proofEntries = listProofEntries(localStorage);
  const activeReviewProgress = progressPercent(activeReviewCount, totalSavedCount);
  const resolvedProgress = progressPercent(resolvedOrPassedCount, totalSavedCount);
  const hiddenRepoHelper = `${hiddenIssueCount.toLocaleString()} issues / ${hiddenRepoCount.toLocaleString()} repos`;
  const reviewFlow = summarizeReviewFlow(store.boardCards);
  const heroRecommendation = getDashboardHeroRecommendation({
    boardCards: store.boardCards,
    githubToken: store.githubToken,
    hiddenFilter: filterHiddenIssues
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
      <div class="glass-card interactive-card rounded-xl p-8 relative overflow-hidden group mb-8">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-primary text-[20px] filled-icon">bolt</span>
              <span class="text-primary font-semibold text-sm tracking-wide uppercase">Next Recommended Action</span>
            </div>
            <h2 class="text-2xl font-headline font-bold text-on-surface tracking-tight mb-2">Continue Review: ${resumeTitle}</h2>
            <p class="text-on-surface-variant max-w-xl">${resumeRepo} #${resumeNumber} - Saved in ${resumeColumn}. Open it to continue board work.</p>
          </div>
          <button class="interactive-button interactive-button-primary shrink-0 px-6 py-3" id="hero-resume-btn" data-id="${resumeId}">
            Resume Review
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  } else if (heroRecommendation.kind === 'configure-token') {
    heroHTML = `
      <div class="glass-card interactive-card rounded-xl p-8 relative overflow-hidden group mb-8">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-primary text-[20px] filled-icon">bolt</span>
              <span class="text-primary font-semibold text-sm tracking-wide uppercase">Next Recommended Action</span>
            </div>
            <h2 class="text-2xl font-headline font-bold text-on-surface tracking-tight mb-2">Configure GitHub token</h2>
            <p class="text-on-surface-variant max-w-xl">Add a GitHub token in Settings to increase API rate limits for searches and lookups.</p>
          </div>
          <button class="interactive-button interactive-button-primary shrink-0 px-6 py-3" id="hero-action-btn">
            Go to Settings
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  } else {
    heroHTML = `
      <div class="glass-card interactive-card rounded-xl p-8 relative overflow-hidden group mb-8">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-primary text-[20px] filled-icon">bolt</span>
              <span class="text-primary font-semibold text-sm tracking-wide uppercase">Next Recommended Action</span>
            </div>
            <h2 class="text-2xl font-headline font-bold text-on-surface tracking-tight mb-2">Find Contributions</h2>
            <p class="text-on-surface-variant max-w-xl">Your token is configured. Search for contribution-worthy GitHub issues and save the best candidates to your board.</p>
          </div>
          <button class="interactive-button interactive-button-primary shrink-0 px-6 py-3" id="hero-find-btn">
            Find Contributions
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  }

  // Saved candidates lists the Board Considering lane (or mocks if empty)
  let savedIssuesHTML = '';
  if (dashboardSavedCards.length === 0) {
    savedIssuesHTML = `
      <div class="p-6 rounded-lg bg-surface-container-lowest border border-outline-variant text-center flex flex-col items-center justify-center gap-2 py-10">
        <span class="material-symbols-outlined text-on-surface-variant text-3xl">bookmarks</span>
        <h4 class="text-on-surface font-medium">No saved candidates</h4>
        <p class="text-xs text-on-surface-variant max-w-xs">Save candidates from Find Contributions to see them on your Dashboard.</p>
        <button class="interactive-button interactive-button-primary mt-2 px-4 py-1.5 text-xs" id="dash-go-find-btn">Find Contributions</button>
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
        <div class="interactive-row p-4 rounded-lg bg-surface-container-lowest border border-outline-variant cursor-pointer group dashboard-issue-card" data-id="${issueId}">
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
      <h4 class="text-on-surface font-medium">No active board work</h4>
      <p class="text-xs text-on-surface-variant max-w-xs">Saved candidates appear on the Board after you save them from Find Contributions.</p>
    </div>
  `;
  const recentProofHTML = proofEntries.length ? proofEntries.slice(0, 3).map(entry => `
    <div class="interactive-row rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div class="mb-1 flex items-center justify-between gap-3">
        <span class="min-w-0 truncate text-sm font-medium text-on-surface">${escapeHTML(entry.snapshot.title || entry.key)}</span>
        <span class="rounded border border-tertiary/25 bg-tertiary/10 px-2 py-0.5 text-[11px] text-tertiary">Proof</span>
      </div>
      <p class="text-xs text-on-surface-variant">${escapeHTML(entry.snapshot.display_key || entry.key)} - ${escapeHTML(formatDate(entry.completed_at))}</p>
    </div>
  `).join('') : `
    <div class="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 text-center">
      <span class="material-symbols-outlined text-3xl text-on-surface-variant">workspace_premium</span>
      <h4 class="mt-2 text-sm font-medium text-on-surface">No Proof Log entries yet</h4>
      <p class="mt-1 text-xs text-on-surface-variant">Move a board card to Merged to preserve completed work.</p>
    </div>
  `;

  container.innerHTML = `
    <section class="p-6 md:p-8">
      <div class="max-w-7xl mx-auto">
        
        <!-- Hero Recommended Section -->
        ${heroHTML}
        
        <!-- Stats Row -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5 mb-8">
          <div class="metric-card flex flex-col gap-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="text-sm font-medium text-on-surface-variant">Saved candidates</span>
                <p class="mt-1 text-xs text-on-surface-variant">Contribution candidates</p>
              </div>
              <span class="material-symbols-outlined text-primary">bookmarks</span>
            </div>
            <span class="metric-card-value">${totalSavedCount}</span>
          </div>

          <div class="metric-card flex flex-col gap-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="text-sm font-medium text-on-surface-variant">Active board work</span>
                <p class="mt-1 text-xs text-on-surface-variant">Considering through PR open</p>
              </div>
              <span class="material-symbols-outlined text-tertiary filled-icon">radio_button_checked</span>
            </div>
            <div class="flex items-end gap-2">
              <span class="metric-card-value">${activeReviewCount}</span>
              <span class="mb-1 text-xs text-on-surface-variant">${activeReviewProgress}% of board</span>
            </div>
            ${renderMetricProgress(activeReviewProgress, 'Active board work progress')}
          </div>

          <div class="metric-card flex flex-col gap-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="text-sm font-medium text-on-surface-variant">Resolved / Passed</span>
                <p class="mt-1 text-xs text-on-surface-variant">Done, passed, or closed</p>
              </div>
              <span class="material-symbols-outlined text-tertiary">merge</span>
            </div>
            <div class="flex items-end gap-2">
              <span class="metric-card-value">${resolvedOrPassedCount}</span>
              <span class="mb-1 text-xs text-on-surface-variant">${resolvedProgress}% complete</span>
            </div>
            ${renderMetricProgress(resolvedProgress, 'Resolved and passed progress')}
          </div>

          <div class="metric-card flex flex-col gap-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="text-sm font-medium text-on-surface-variant">Hidden Results</span>
                <p class="mt-1 text-xs text-on-surface-variant">Filtered from future searches</p>
              </div>
              <span class="material-symbols-outlined text-primary">visibility_off</span>
            </div>
            <span class="metric-card-value">${hiddenTotalCount}</span>
            <p class="text-xs text-on-surface-variant">${hiddenRepoHelper}</p>
          </div>

          <div class="metric-card flex flex-col gap-4 md:col-span-2 xl:col-span-1">
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="text-sm font-medium text-on-surface-variant">Board flow</span>
                <p class="mt-1 text-xs text-on-surface-variant">Distribution across lanes</p>
              </div>
              <span class="material-symbols-outlined text-primary">stacked_bar_chart</span>
            </div>
            ${renderBoardFlow(reviewFlow)}
          </div>
        </div>
        
        <!-- Bento Grid Contents -->
        <div class="bento-grid">
          <!-- Saved candidates (Bento Large) -->
          <div class="bento-item bento-large interactive-card p-6 flex flex-col gap-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-headline font-bold text-on-surface tracking-tight flex items-center gap-2">
                <span class="material-symbols-outlined text-on-surface-variant">bookmarks</span>
                Saved candidates
              </h3>
              <button class="interactive-button interactive-button-secondary px-3 py-1.5 text-xs" id="dash-view-board-btn">View Kanban Board</button>
            </div>
            <div class="flex flex-col gap-3">
              ${savedIssuesHTML}
            </div>
          </div>
          
          <!-- Active board work -->
          <div class="bento-item interactive-card p-6 flex flex-col gap-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-headline font-bold text-on-surface tracking-tight flex items-center gap-2">
                <span class="material-symbols-outlined text-on-surface-variant">commit</span>
                Active board work
              </h3>
            </div>
            <div class="flex flex-col gap-4">
              ${localReviewHTML}
            </div>
            <button class="interactive-button interactive-button-secondary mt-auto w-full py-2" id="dash-view-local-review-btn">
              View Board
            </button>
          </div>

          <!-- Proof Log -->
          <div class="bento-item interactive-card p-6 flex flex-col gap-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-headline font-bold text-on-surface tracking-tight flex items-center gap-2">
                <span class="material-symbols-outlined text-tertiary">workspace_premium</span>
                Proof Log
              </h3>
              <span class="rounded border border-outline-variant bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">${proofEntries.length}</span>
            </div>
            <div class="flex flex-col gap-3">
              ${recentProofHTML}
            </div>
            <button class="interactive-button interactive-button-secondary mt-auto w-full py-2" id="dash-view-profile-btn">
              View Profile
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

  const profileBtn = document.getElementById('dash-view-profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      store.setScreen('profile');
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

  bindBoardFlowInteractions();
}

function bindBoardFlowInteractions() {
  const helper = document.getElementById('board-flow-next-move');
  const defaultHelper = helper?.textContent || '';
  const items = document.querySelectorAll('[data-review-flow-lane]');
  const chips = document.querySelectorAll('.review-flow-chip');

  if (!items.length || !chips.length) return;

  const setActiveLane = (lane, nextMove) => {
    items.forEach(item => {
      item.classList.toggle('is-active', item.getAttribute('data-review-flow-lane') === lane);
    });
    if (helper && nextMove) {
      helper.textContent = nextMove;
    }
  };

  const clearActiveLane = () => {
    items.forEach(item => item.classList.remove('is-active'));
    if (helper) {
      helper.textContent = defaultHelper;
    }
  };

  chips.forEach(chip => {
    const lane = chip.getAttribute('data-review-flow-lane');
    const nextMove = chip.getAttribute('data-review-flow-next');
    chip.addEventListener('mouseenter', () => setActiveLane(lane, nextMove));
    chip.addEventListener('focus', () => setActiveLane(lane, nextMove));
    chip.addEventListener('mouseleave', clearActiveLane);
    chip.addEventListener('blur', clearActiveLane);
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
  if (filters.labels?.length) return 'Broaden search first: remove label filters.';
  if (filters.stars && filters.stars !== 'Any') return 'Relax stars first: switch stars to Any.';
  if (filters.comments && filters.comments !== 'Any') return 'Relax comments first: switch comments to Any.';
  if (filters.languages?.length) return 'Relax language first: clear selected languages.';
  if (filters.updatedDate && filters.updatedDate !== 'Any') return 'Relax updated date first: switch updated date to Any.';
  return 'PR Dashboard searches GitHub issues, not users or profiles. Try an issue topic, repo name, or owner/repo.';
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
          <h3 class="text-on-surface font-medium text-lg mb-1">No matching GitHub issues found</h3>
          <p class="text-sm text-on-surface-variant">PR Dashboard searches GitHub issues only. It does not search users, profiles, or every repository.</p>
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
        <span class="text-sm text-on-surface">${escapeHTML(getFirstRelaxationHint(filters))} Broaden Search keeps your search text and removes contribution filters.</span>
        <button class="interactive-button interactive-button-primary px-4 py-2" id="broaden-search-btn">Broaden Search</button>
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
  const applyHiddenFilter = store.lastSearchMode !== 'lookup';
  const visibleResults = Array.isArray(results) && applyHiddenFilter ? filterHiddenIssues(results) : results;
  const hiddenResultsCount = Array.isArray(results) && Array.isArray(visibleResults) && applyHiddenFilter
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
      <button class="interactive-chip px-2.5 py-1 text-xs rounded label-filter-btn ${btnClass}" data-label="${safeLabel}">${safeLabel}</button>
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
        
        ${visibleResults ? renderIssueCardsList(visibleResults, { applyHiddenFilter }) : ''}
      </div>
    `;
    countText = visibleResults ? `Showing ${visibleResults.length} issues${hiddenCountText}` : 'Request failed';
  } else if (visibleResults !== null) {
    countText = `Showing ${visibleResults.length} ${appliedFilters.includeClosed || store.lastSearchMode === 'lookup' ? 'issues' : 'open issues'}${hiddenCountText}`;
    if (visibleResults.length === 0) {
      resultsHTML = renderNoResults(queryPreview, filters);
    } else {
      resultsHTML = renderIssueCardsList(visibleResults, { applyHiddenFilter });
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
            <strong>GitHub API rate limits</strong>: Public searches without a GitHub token are rate-limited to 10 requests per minute by GitHub.
            ${token ? '<span class="text-tertiary">A GitHub token is active.</span>' : 'You can paste an optional fine-grained token in <strong>Settings</strong> to increase these limits.'}
          </div>
        </div>
        
            <button class="interactive-button interactive-button-primary px-6 py-2.5" id="start-search-btn">
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
              <button class="finder-mode-btn interactive-button rounded-md px-3 py-1.5 text-sm ${findModeClass}" data-mode="find" type="button">Find Contributions</button>
              <button class="finder-mode-btn interactive-button rounded-md px-3 py-1.5 text-sm ${lookupModeClass}" data-mode="lookup" type="button">Lookup</button>
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
            <button class="interactive-button interactive-button-primary px-6 py-3.5 rounded-xl shrink-0" id="search-trigger-btn">
              Search
            </button>
          </div>
          <div class="mt-3 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-left">
            <div class="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">GitHub query preview</div>
            <code class="block text-xs text-on-surface break-words" id="github-query-preview">${escapeHTML(queryPreview)}</code>
          </div>
          
          <!-- Presets -->
          <div class="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button class="interactive-chip bg-surface-container border-outline-variant text-on-surface-variant preset-search-btn" data-preset="quick-wins">
              <span class="material-symbols-outlined text-[16px]">bolt</span> Starter Picks
            </button>
            <button class="interactive-chip bg-surface-container border-outline-variant text-on-surface-variant preset-search-btn" data-preset="deep-dives">
              <span class="material-symbols-outlined text-[16px]">psychology</span> Deep Dives
            </button>
            <button class="interactive-chip bg-surface-container border-outline-variant text-on-surface-variant preset-search-btn" data-preset="docs-only">
              <span class="material-symbols-outlined text-[16px]">description</span> Documentation Only
            </button>
            <button class="interactive-chip bg-surface-container border-outline-variant text-on-surface-variant preset-search-btn" data-preset="low-noise">
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
            <button class="interactive-button interactive-button-primary w-full px-4 py-2" id="apply-filters-btn">
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

  const broadenBtn = document.getElementById('broaden-search-btn');
  if (broadenBtn) {
    broadenBtn.addEventListener('click', () => {
      applyFilterPatch(store, getRelaxedFilters());
      runFinderSearch(store.searchQuery);
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
function renderIssueCardsList(issuesList, options = {}) {
  // Sort list if local sorting is needed
  const applyHiddenFilter = options.applyHiddenFilter !== false;
  let sorted = applyHiddenFilter ? filterHiddenIssues(issuesList) : [...(issuesList || [])];
  
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
    const hiddenLocally = !applyHiddenFilter && (isIssueHidden(issue) || isRepoHidden(issue));
    const lookupWarningHTML = lookupRisky ? `
      <div class="rounded border border-error/25 bg-error-container/10 px-3 py-2 text-xs text-error flex items-center gap-2">
        <span class="material-symbols-outlined text-[15px]">warning</span>
        Not a contribution candidate
      </div>
    ` : '';
    const hiddenBadgeHTML = hiddenLocally ? `
      <div class="rounded border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary flex items-center gap-2">
        <span class="material-symbols-outlined text-[15px]">visibility_off</span>
        Hidden locally
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

    const saved = isIssueSavedToBoard(issue);

    return `
      <article class="issue-card interactive-card group rounded-xl p-5 cursor-pointer flex flex-col gap-3 ${isFeatured ? 'xl:col-span-2' : ''}" data-id="${issueId}">
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
        ${hiddenBadgeHTML}
        
        <div class="mt-auto flex flex-wrap items-center gap-2">
          ${labelsHTML}
          <span class="interactive-chip rounded border ${rating.bgClass} px-2 py-0.5 text-xs">${fitObj.score}% Match</span>
          <span class="interactive-chip rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">Fit: ${escapeHTML(contributionBrief.bestFor)}</span>
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
          <div class="flex flex-wrap items-center gap-2">
            <button class="action-button border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary inspect-issue-btn" data-id="${issueId}">
            Inspect
            </button>
            <button class="action-button px-3 py-1.5 text-xs save-issue-btn ${saved ? 'bg-tertiary/10 text-tertiary border-tertiary/20' : 'interactive-button-secondary'}" data-id="${issueId}">
              <span class="material-symbols-outlined text-[14px]">${saved ? 'check' : 'bookmark'}</span>
              ${saved ? 'View on board' : 'Save'}
            </button>
            ${hiddenLocally ? `<button class="action-button interactive-button-secondary px-3 py-1.5 text-xs unhide-card-btn" data-id="${issueId}">
              <span class="material-symbols-outlined text-[14px]">visibility</span>
              Unhide
            </button>` : ''}
            <button class="action-button interactive-button-secondary px-3 py-1.5 text-xs hide-issue-btn" data-id="${issueId}">
              <span class="material-symbols-outlined text-[14px]">visibility_off</span>
              Hide
            </button>
            ${issueUrl ? `<a class="action-button interactive-button-secondary px-3 py-1.5 text-xs" href="${escapeHTML(issueUrl)}" target="_blank" rel="noopener noreferrer">
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
      const items = getSearchItemsForActions();
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
      const items = getSearchItemsForActions();
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
      const items = getSearchItemsForActions();
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
      const items = getSearchItemsForActions();
      const issue = items.find(i => i.id === issueId);
      if (issue) {
        const fitObj = calculateFitScore(issue);
        if (isIssueSavedToBoard(issue)) {
          store.setScreen('board');
          return;
        }
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
      const items = getSearchItemsForActions();
      const issue = items.find(i => i.id === issueId);
      if (issue) {
        store.hideIssue(issue);
      }
    });
  });

  document.querySelectorAll('.unhide-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const issueId = parseInt(btn.getAttribute('data-id'), 10);
      const issue = getSearchItemsForActions().find(i => i.id === issueId);
      if (issue) {
        const issueKey = getCanonicalIssueKey(issue);
        const repoKey = getCanonicalRepoKey(issue);
        if (issueKey) store.unhideHiddenItem('issue', issueKey);
        if (repoKey) store.unhideHiddenItem('repo', repoKey);
      }
    });
  });
}

/**
 * 3. KANBAN BOARD VIEW
 */
async function refreshBoardCardFromGitHub(card) {
  const result = await fetchIssueMetadataForRefresh(card);
  return result.notModified
    ? markIssueMetadataUnchanged(card, { etag: result.etag })
    : mergeIssueMetadata(card, result.issue, { etag: result.etag });
}

function formatBoardRefreshStatus(result, label = 'active board cards') {
  if (result.stoppedForRateLimit) {
    return `Refreshed ${result.refreshed} ${label}. ${result.rateLimitMessage}`;
  }
  if (result.failed) {
    return `Refreshed ${result.refreshed} ${label}. ${result.failed} could not be refreshed.`;
  }
  return `Refreshed ${result.refreshed} ${label}.`;
}

async function refreshBoardEntriesFromGitHub({ statusEl, entries, requestCount, modeLabel, emptyMessage, cancelMessage, confirmLargeBatch = false }) {
  if (requestCount === 0) {
    const statusMessage = emptyMessage;
    store.setBoardRefreshStatus(statusMessage);
    if (statusEl) statusEl.textContent = statusMessage;
    return;
  }

  if (
    confirmLargeBatch
    && shouldConfirmBatchRefresh({ token: store.githubToken, requestCount })
    && !window.confirm(getBatchRefreshWarning({ token: store.githubToken, requestCount }))
  ) {
    const statusMessage = cancelMessage;
    store.setBoardRefreshStatus(statusMessage);
    if (statusEl) statusEl.textContent = statusMessage;
    return;
  }

  const result = await refreshActiveBoardCardsSerially(store.boardCards, refreshBoardCardFromGitHub, { entries });
  store.setBoardCards(result.nextBoard);
  const statusMessage = formatBoardRefreshStatus(result, modeLabel);
  store.setBoardRefreshStatus(statusMessage);
  if (statusEl) statusEl.textContent = statusMessage;
}

async function refreshStaleBoardFromGitHub(statusEl) {
  const entries = getStaleBoardRefreshEntries(store.boardCards);
  await refreshBoardEntriesFromGitHub({
    statusEl,
    entries,
    requestCount: entries.length,
    modeLabel: 'stale board cards',
    emptyMessage: 'No stale active board cards to refresh.',
    cancelMessage: 'Stale card refresh cancelled.',
    confirmLargeBatch: true
  });
}

async function refreshAllActiveBoardFromGitHub(statusEl) {
  const requestCount = getActiveBoardRefreshRequestCount(store.boardCards);
  await refreshBoardEntriesFromGitHub({
    statusEl,
    requestCount,
    modeLabel: 'active board cards',
    emptyMessage: 'No active board cards to refresh.',
    cancelMessage: 'Active board refresh cancelled.',
    confirmLargeBatch: true
  });
}

async function refreshSingleSavedBoardCard(card) {
  const updatedCard = await refreshBoardCardFromGitHub(card);
  store.updateBoardCard(card.id, () => updatedCard);
  return updatedCard;
}

function renderBoard(container) {
  const totalCards = Object.values(store.boardCards).flat().length;
  const activeRefreshRequestCount = getActiveBoardRefreshRequestCount(store.boardCards);
  const staleRefreshRequestCount = getStaleBoardRefreshRequestCount(store.boardCards);
  const staleRefreshTotalCount = getStaleBoardRefreshTotalCount(store.boardCards);
  const staleRefreshHelper = staleRefreshTotalCount > staleRefreshRequestCount
    ? `${staleRefreshRequestCount} of ${staleRefreshTotalCount} stale cards selected.`
    : '';
  
  // Render Board lane columns
  const renderColumnsHTML = (columns, options = {}) => columns.map((col) => {
    const cIdx = BOARD_COLUMNS.indexOf(col);
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
          ${col !== 'Passed' ? `<button class="ml-2 underline whitespace-nowrap move-passed-btn" data-id="${cardId}">Move to Passed</button>` : ''}
        </div>
      ` : '';
      const refreshErrorHTML = card.refresh_error ? `
        <div class="mb-3 rounded border border-error/25 bg-error-container/10 p-2 text-[11px] text-error">${escapeHTML(card.refresh_error)}</div>
      ` : '';
      const activitySummaryHTML = isGitHubActivityVisible(card.github_activity) ? `
        <div class="mb-3 rounded border border-primary/20 bg-primary/10 p-2 text-[11px] text-primary">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="font-semibold">New GitHub activity</span>
              <span class="text-on-surface-variant"> - ${escapeHTML(card.github_activity.summary || 'Updated on GitHub since last refresh.')}</span>
            </div>
            <button class="shrink-0 rounded border border-primary/25 px-1.5 py-0.5 text-[10px] text-primary mark-activity-reviewed-btn" data-id="${cardId}">Mark reviewed</button>
          </div>
        </div>
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
      const rightArrowDisabled = cIdx === BOARD_COLUMNS.length - 1 ? 'disabled style="opacity:0.3;"' : '';

      return `
        <!-- Card -->
        <div class="kanban-card interactive-card rounded-lg p-3 cursor-pointer group mb-3 relative board-card-item" data-id="${cardId}">
          <button class="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded border border-transparent text-on-surface-variant transition-colors hover:border-error/30 hover:text-error delete-card-btn" data-id="${cardId}"><span class="material-symbols-outlined text-[14px]">close</span></button>
          
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
          ${activitySummaryHTML}
          ${workingChecklistHTML}
          ${prOpenHTML}
          ${mergedTextHTML}
          ${passedTextHTML}
          
          <!-- Card Footer & Direction arrows -->
          <div class="flex justify-between items-center mt-auto pt-2 border-t border-outline-variant/50">
            <span class="text-[10px] text-on-surface-variant">${cardDate}</span>
            
            <div class="flex items-center gap-1">
              <button class="action-button h-6 w-6 rounded bg-surface-container-lowest border-outline-variant p-0 text-xs hover:border-primary move-left-btn" data-id="${cardId}" ${leftArrowDisabled}>
                <span class="material-symbols-outlined text-[14px]">arrow_left</span>
              </button>
              <button class="action-button h-6 w-6 rounded bg-surface-container-lowest border-outline-variant p-0 text-xs hover:border-primary move-right-btn" data-id="${cardId}" ${rightArrowDisabled}>
                <span class="material-symbols-outlined text-[14px]">arrow_right</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!-- Column lane -->
      <div class="kanban-column ${options.compact ? 'kanban-column-compact' : ''} flex flex-col h-full bg-surface-container-lowest/50 rounded-lg p-3">
        <div class="flex items-center justify-between mb-4 px-1 shrink-0">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full ${dotColor}"></div>
            <h3 class="text-xs font-semibold text-on-surface uppercase tracking-wider">${col}</h3>
            <span class="text-xs font-medium text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline-variant">${cards.length}</span>
          </div>
        </div>
        
        <!-- Cards Viewport -->
        <div class="flex-grow overflow-y-auto pr-1 ${options.compact ? 'pb-2' : 'pb-6'} custom-scrollbar board-lane-cards-container" data-lane="${col}">
          ${cardsHTML}
        </div>
      </div>
    `;
  }).join('');
  const activeColumnsHTML = renderColumnsHTML(ACTIVE_BOARD_COLUMNS);
  const completedColumnsHTML = renderColumnsHTML(COMPLETED_BOARD_COLUMNS, { compact: true });

  container.innerHTML = `
    <!-- Kanban Board layout -->
    <section class="board-page flex min-h-[calc(100vh-3.5rem)] flex-col bg-background">
      
      <!-- Board Header Context -->
      <div class="px-6 md:px-8 py-5 border-b border-outline-variant flex-shrink-0 flex flex-col gap-4 md:flex-row md:justify-between md:items-center bg-surface-container-lowest">
        <div class="min-w-0">
          <h1 class="text-2xl font-headline font-bold text-on-surface mb-1">Contribution Board</h1>
          <p class="text-sm text-on-surface-variant">Track saved candidates and local contribution decisions across repositories.</p>
        </div>
        
        <div class="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
          <div class="min-w-0 text-xs text-on-surface-variant">
            <div id="board-refresh-status">${escapeHTML(store.boardRefreshStatus)}</div>
            ${staleRefreshHelper ? `<div>${escapeHTML(staleRefreshHelper)}</div>` : ''}
          </div>
          <button class="interactive-button interactive-button-primary py-1.5 px-3" id="board-refresh-stale-btn" ${staleRefreshRequestCount === 0 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-[16px]">sync</span> Refresh stale cards (${staleRefreshRequestCount} requests)
          </button>
          <button class="interactive-button interactive-button-secondary py-1.5 px-3" id="board-refresh-all-btn" ${activeRefreshRequestCount === 0 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-[16px]">sync</span> Refresh all active cards (${activeRefreshRequestCount} requests)
          </button>
          <button class="interactive-button interactive-button-danger py-1.5 px-3" id="board-clear-btn" ${totalCards === 0 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-[16px]">delete</span> Clear Board
          </button>
        </div>
      </div>
      
      <!-- Scrollable Kanban Area -->
      <div class="board-page-body flex-1 p-4 sm:p-6 md:p-8">
        <div class="board-layout-shell" style="--board-layout-max-width: ${BOARD_LAYOUT_MAX_WIDTH}px;">
          <section class="board-section board-active-section" data-board-section="active">
            <div class="board-section-heading">
              <h2>Active workflow</h2>
              <span>Manual refreshes run only from saved active cards.</span>
            </div>
            <div class="board-active-grid">
              ${activeColumnsHTML}
            </div>
          </section>
          <section class="board-section board-completed-section" data-board-section="completed">
            <div class="board-section-heading">
              <h2>Completed</h2>
              <span>Compact local outcomes.</span>
            </div>
            <div class="board-completed-grid">
              ${completedColumnsHTML}
            </div>
          </section>
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

  document.querySelectorAll('.mark-activity-reviewed-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = parseInt(btn.getAttribute('data-id'), 10);
      store.markGitHubActivityReviewed(cardId);
    });
  });

  const refreshStaleBtn = document.getElementById('board-refresh-stale-btn');
  if (refreshStaleBtn) {
    refreshStaleBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('board-refresh-status');
      refreshStaleBtn.disabled = true;
      store.setBoardRefreshStatus('Refreshing stale cards...');
      if (statusEl) statusEl.textContent = 'Refreshing stale cards...';
      await refreshStaleBoardFromGitHub(statusEl);
    });
  }

  const refreshAllBtn = document.getElementById('board-refresh-all-btn');
  if (refreshAllBtn) {
    refreshAllBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('board-refresh-status');
      refreshAllBtn.disabled = true;
      store.setBoardRefreshStatus('Refreshing active board...');
      if (statusEl) statusEl.textContent = 'Refreshing active board...';
      await refreshAllActiveBoardFromGitHub(statusEl);
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
function handleExportLocalData() {
  const payload = exportLocalData(localStorage);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pr-dashboard-local-data-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindLocalDataImport(inputId, statusId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    const status = document.getElementById(statusId);
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const result = importLocalData(localStorage, payload);
      store.boardCards = result.boardCards || store.boardCards;
      store.profile = payload.profile || store.profile;
      store.notify();
      if (status) {
        status.textContent = result.imported ? 'Local data imported.' : 'Import failed: unsupported file.';
        status.className = result.imported
          ? 'text-xs text-tertiary'
          : 'text-xs text-error';
      }
    } catch (error) {
      if (status) {
        status.textContent = `Import failed: ${error.message}`;
        status.className = 'text-xs text-error';
      }
    } finally {
      input.value = '';
    }
  });
}

function formatProofLogStatus(status) {
  return status === 'marked_complete' ? 'Marked complete locally' : String(status || 'Marked complete locally');
}

function formatProofLogSource(source) {
  if (source === 'board_merged') return 'Board Merged';
  if (source === 'startup_backfill') return 'Board backfill';
  if (source === 'manual_lookup') return 'Legacy Lookup';
  return source ? String(source).replace(/_/g, ' ') : 'Local';
}

function renderProofLogRows(entries) {
  if (!entries.length) {
    return `
      <div class="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 text-center">
        <span class="material-symbols-outlined text-3xl text-on-surface-variant">workspace_premium</span>
        <h3 class="mt-2 text-sm font-medium text-on-surface">No Proof Log entries yet</h3>
        <p class="mt-1 text-xs text-on-surface-variant">Move a board card to Merged to preserve completed work.</p>
      </div>
    `;
  }

  return entries.map(entry => `
    <div class="interactive-row rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="min-w-0">
          <div class="mb-1 flex flex-wrap items-center gap-2">
            <span class="rounded border border-tertiary/25 bg-tertiary/10 px-2 py-0.5 text-[11px] text-tertiary">${escapeHTML(formatProofLogStatus(entry.status))}</span>
            <span class="font-mono text-xs text-on-surface-variant">${escapeHTML(entry.snapshot.display_key || entry.key)}</span>
          </div>
          <h3 class="truncate text-sm font-medium text-on-surface">${escapeHTML(entry.snapshot.title || entry.key)}</h3>
          <p class="mt-1 text-xs text-on-surface-variant">Completed ${escapeHTML(formatDate(entry.completed_at))}. Source: ${escapeHTML(formatProofLogSource(entry.source))}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${entry.proof_url ? `<a class="action-button interactive-button-secondary px-3 py-1.5 text-xs" href="${escapeHTML(entry.proof_url)}" target="_blank" rel="noopener noreferrer">Open proof</a>` : ''}
          <button class="action-button interactive-button-danger px-3 py-1.5 text-xs proof-remove-btn" data-key="${escapeHTML(entry.key)}">Remove</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderProfile(container) {
  const proofEntries = listProofEntries(localStorage);
  const alerts = buildLocalAlerts(store.boardCards);
  const profile = store.profile;
  const displayName = profile?.name || profile?.login || 'Local contributor';
  const loginLine = profile?.login ? `GitHub: ${profile.login}` : 'No GitHub identity saved yet';
  const profileAvatarHTML = renderProfileAvatarFrame(
    profile,
    'flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-primary-container text-lg font-bold text-on-primary-container'
  );

  container.innerHTML = `
    <section class="p-6 md:p-12">
      <div class="mx-auto max-w-5xl space-y-8">
        <header class="interactive-card rounded-xl p-6">
          <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div class="flex items-center gap-4">
              ${profileAvatarHTML}
              <div>
                <h1 class="text-3xl font-headline font-bold tracking-tight text-on-background">Profile</h1>
                <p class="text-sm text-on-surface-variant">${escapeHTML(displayName)} - ${escapeHTML(loginLine)}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="interactive-button interactive-button-secondary px-4 py-2" id="profile-export-btn">Export Local Data</button>
              <label class="interactive-button interactive-button-secondary px-4 py-2 cursor-pointer">
                Import Local Data
                <input class="hidden" id="profile-import-input" type="file" accept="application/json" />
              </label>
            </div>
          </div>
          <p class="mt-3 text-xs text-on-surface-variant" id="profile-import-status">Exports include Board cards, Hidden Results, profile, and Proof Log. GitHub tokens and repo metadata cache are excluded.</p>
        </header>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div class="metric-card">
            <span class="text-sm text-on-surface-variant">Proof Log</span>
            <div class="mt-4 metric-card-value">${proofEntries.length}</div>
          </div>
          <div class="metric-card">
            <span class="text-sm text-on-surface-variant">Saved candidates</span>
            <div class="mt-4 metric-card-value">${Object.values(store.boardCards).flat().length}</div>
          </div>
          <div class="metric-card">
            <span class="text-sm text-on-surface-variant">Review reminders</span>
            <div class="mt-4 metric-card-value">${alerts.length}</div>
          </div>
        </div>

        <section class="interactive-card rounded-xl p-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-headline font-bold text-on-surface">Proof Log</h2>
            <span class="rounded border border-outline-variant bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">${proofEntries.length}</span>
          </div>
          <div class="space-y-3">${renderProofLogRows(proofEntries)}</div>
        </section>

        <section class="interactive-card rounded-xl p-6">
          <h2 class="mb-2 text-lg font-headline font-bold text-on-surface">Review reminders</h2>
          <p class="mb-4 text-xs text-on-surface-variant">Review reminders are generated from your local board state and manual refreshes.</p>
          <div class="space-y-3">
            ${alerts.length ? alerts.map(alert => `
              <div class="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
                <div class="mb-1 flex items-center justify-between gap-3">
                  <span class="text-sm font-medium text-on-surface">${escapeHTML(alert.title)}</span>
                  <span class="text-[10px] uppercase tracking-wide text-primary">${escapeHTML(alert.column)}</span>
                </div>
                <p class="text-xs text-on-surface-variant">${escapeHTML(alert.message)}</p>
              </div>
            `).join('') : '<p class="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">No review reminders right now.</p>'}
          </div>
        </section>
      </div>
    </section>
  `;

  const exportBtn = document.getElementById('profile-export-btn');
  if (exportBtn) exportBtn.addEventListener('click', handleExportLocalData);
  bindAvatarFallbacks(container);
  bindLocalDataImport('profile-import-input', 'profile-import-status');
  document.querySelectorAll('.proof-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.removeProofLogEntry(btn.getAttribute('data-key'));
    });
  });
}

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
          ? `<a class="action-button border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">Open link</a>`
          : '<span class="text-xs text-on-surface-variant">Open unavailable</span>';
        return `
          <div class="interactive-row grid grid-cols-1 md:grid-cols-[72px_minmax(0,1fr)_120px_auto_auto] items-center gap-3 bg-surface-container-lowest px-4 py-3">
            <span class="w-fit rounded border border-outline-variant bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant">${typeLabel}</span>
            <span class="min-w-0 truncate font-mono text-sm text-on-surface">${safeKey}</span>
            <span class="text-xs text-on-surface-variant">${safeDate}</span>
            ${openLinkHTML}
            <button class="action-button interactive-button-secondary hidden-result-unhide-btn px-3 py-1.5 text-xs" data-type="${type}" data-key="${safeKey}">
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
    <div class="interactive-card rounded-xl overflow-hidden">
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
          <h1 class="text-3xl font-headline font-bold tracking-tight text-on-background">GitHub token</h1>
          <p class="text-on-surface-variant">Add an optional token for higher GitHub API limits.</p>
          <p class="text-xs text-on-surface-variant">
            Find Contributions uses GitHub Search limits, while Lookup and saved-card refresh use REST/core limits.
            <a class="text-primary hover:underline" href="https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2026-03-10" target="_blank" rel="noopener noreferrer">GitHub REST API rate limits</a>
          </p>
        </header>
        
        <!-- Local Storage Warning Indicator (Only shown when Remember checked) -->
        <div id="settings-storage-warning" class="interactive-card bg-error-container/10 border-error/30 rounded-lg p-5 flex items-start gap-4" style="display: ${remember ? 'flex' : 'none'};">
          <span class="material-symbols-outlined text-error mt-0.5">warning</span>
          <div>
            <h3 class="text-sm font-semibold text-error mb-1">Local Browser Security Warning</h3>
            <p class="text-sm text-on-error-container leading-relaxed">
              Stored in this browser. Do not use this on shared machines. localStorage is not secure storage for secrets.
            </p>
          </div>
        </div>
        
        <!-- Default callout explaining limits -->
        <div class="interactive-card border-tertiary/30 rounded-lg p-5 flex items-start gap-4">
          <span class="material-symbols-outlined text-tertiary mt-0.5">lock</span>
          <div>
            <h3 class="text-sm font-semibold text-tertiary mb-1">Local Session Storage by Default</h3>
            <p class="text-sm text-on-secondary-container leading-relaxed">
              We value your secrets. Access tokens are stored temporarily in your session-only memory by default. They are never transmitted to external databases and all API requests are dispatched directly from your browser.
            </p>
          </div>
        </div>
        
        <!-- Configuration Card -->
        <div class="interactive-card rounded-xl overflow-hidden">
          <div class="p-6 border-b border-outline-variant bg-surface-dim/50">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">key</span>
              GitHub token
            </h2>
          </div>
          
          <div class="p-6 space-y-8">
            <!-- Input string -->
            <div class="space-y-3">
              <label class="block text-sm font-medium text-on-surface" for="settings-pat-input">GitHub token</label>
              <div class="relative group">
                <input class="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3.5 text-on-background font-mono text-sm focus:outline-none placeholder:text-outline" id="settings-pat-input" placeholder="Paste token for this session" type="password"/>
                <button class="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary" id="toggle-pat-visibility" style="background:none; border:none;">
                  <span class="material-symbols-outlined" id="visibility-icon">visibility</span>
                </button>
              </div>
              
              <div class="flex justify-between items-center text-xs text-on-surface-variant">
                <span>Supports fine-grained or classic tokens. No private repository scopes required.</span>
                <a class="text-primary hover:underline flex items-center gap-1" href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">Generate on GitHub <span class="material-symbols-outlined text-[14px]">open_in_new</span></a>
              </div>
            </div>
            
            <!-- Scope checklist showing honest scope mapping -->
            <div class="space-y-4">
              <h3 class="text-sm font-medium text-on-surface">Recommended scopes</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="interactive-row flex items-start gap-3 p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
                  <div class="w-5 h-5 rounded bg-tertiary/10 border border-tertiary/30 flex items-center justify-center text-tertiary">
                    <span class="material-symbols-outlined text-[14px] filled-icon">check</span>
                  </div>
                  <div>
                    <div class="font-mono text-sm text-on-surface mb-0.5">public_repo (optional)</div>
                    <div class="text-xs text-on-surface-variant">Read public repositories to search active issues.</div>
                  </div>
                </div>
                <div class="interactive-row flex items-start gap-3 p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
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
            <label class="interactive-row flex items-start gap-3 p-4 rounded-lg border border-outline-variant bg-surface-container-lowest cursor-pointer">
              <input class="mt-0.5" id="settings-remember-checkbox" type="checkbox" ${remember ? 'checked' : ''} />
              <div>
                <span class="text-sm font-semibold text-on-surface block">Remember token locally</span>
                <span class="text-xs text-on-surface-variant mt-1 block leading-relaxed">Save token within browser local storage. Useful to avoid pasting token repeatedly. Displays a security banner as it is stored in cleartext.</span>
              </div>
            </label>
            
            <!-- Status message container -->
            <div id="settings-connection-status" style="display:none;"></div>
            
            <!-- Actions -->
            <div class="pt-4 flex flex-wrap justify-end gap-4">
              <button class="interactive-button interactive-button-secondary px-6 py-2.5" id="test-connection-btn">
                Test Connection
              </button>
              <button class="interactive-button interactive-button-primary px-6 py-2.5" id="save-settings-btn">
                Save Configuration
              </button>
            </div>
            
          </div>
        </div>
        
        ${renderHiddenResultsManager()}

        <div class="interactive-card rounded-xl overflow-hidden">
          <div class="p-6 border-b border-outline-variant bg-surface-dim/50">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">sync_alt</span>
              Export and Import Local Data
            </h2>
          </div>
          <div class="p-6 space-y-4">
            <p class="text-sm text-on-surface-variant">Export Local Data and Import Local Data move Board cards, Hidden Results, profile metadata, and Proof Log entries between browsers. GitHub tokens and repo metadata cache are excluded.</p>
            <div class="flex flex-wrap gap-3">
              <button class="interactive-button interactive-button-secondary px-4 py-2" id="settings-export-local-data-btn">Export Local Data</button>
              <label class="interactive-button interactive-button-secondary px-4 py-2 cursor-pointer">
                Import Local Data
                <input class="hidden" id="settings-import-local-data-input" type="file" accept="application/json" />
              </label>
            </div>
            <p class="text-xs text-on-surface-variant" id="settings-import-local-data-status"></p>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="pt-8 border-t border-outline-variant space-y-4">
          <h3 class="text-sm font-semibold text-error uppercase tracking-wider">Danger Zone</h3>
          <div class="interactive-row flex flex-col gap-4 p-5 rounded-lg border border-error/20 bg-error-container/10 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="font-medium text-on-surface mb-1">Clear GitHub token and settings</div>
              <div class="text-sm text-on-surface-variant">Remove the GitHub token, remember-token setting, and connection state. Board cards are kept.</div>
            </div>
            <button class="interactive-button interactive-button-danger px-4 py-2" id="clear-token-settings-btn">
              Clear GitHub Token
            </button>
          </div>
          <div class="interactive-row flex flex-col gap-4 p-5 rounded-lg border border-error/20 bg-error-container/10 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="font-medium text-on-surface mb-1">Clear board data</div>
              <div class="text-sm text-on-surface-variant">Remove saved candidate cards and local board progress. GitHub token settings are kept.</div>
            </div>
            <button class="interactive-button interactive-button-danger px-4 py-2" id="clear-board-settings-btn">
              Clear Board
            </button>
          </div>
          <div class="interactive-row flex flex-col gap-4 p-5 rounded-lg border border-error/20 bg-error-container/10 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="font-medium text-on-surface mb-1">Clear hidden items</div>
              <div class="text-sm text-on-surface-variant">Show previously hidden issues and repositories in future results.</div>
            </div>
            <button class="interactive-button interactive-button-danger px-4 py-2" id="clear-hidden-settings-btn">
              Clear Hidden
            </button>
          </div>
          <div class="interactive-row flex flex-col gap-4 p-5 rounded-lg border border-error/20 bg-error-container/10 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="font-medium text-on-surface mb-1">Clear all app data</div>
              <div class="text-sm text-on-surface-variant">Remove GitHub token settings and saved board data from this browser.</div>
            </div>
            <button class="interactive-button interactive-button-danger px-4 py-2" id="clear-all-settings-btn">
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
          store.updateProfileFromGitHubUser(userObj, { notify: false });
          updateHeaderProfile();
          statusDiv.className = 'p-3.5 rounded bg-tertiary/10 border border-tertiary/30 text-tertiary text-xs flex items-center gap-2';
          statusDiv.textContent = `Connection active! Welcome, ${userObj.login || 'GitHub user'} (Rate limits verified).`;
          
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
      
      updateHeaderProfile();
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
        statusDiv.textContent = "Board data removed. GitHub token settings were kept.";
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

  const settingsExportBtn = document.getElementById('settings-export-local-data-btn');
  if (settingsExportBtn) {
    settingsExportBtn.addEventListener('click', handleExportLocalData);
  }
  bindLocalDataImport('settings-import-local-data-input', 'settings-import-local-data-status');
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
  const saved = isIssueSavedToBoard(issue);
  const hiddenLocally = isIssueHidden(issue) || isRepoHidden(issue);
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
      <button class="action-button interactive-button-danger px-3 py-2 text-xs" id="inspector-move-passed-btn">Move to Passed</button>
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
  const hiddenInspectorHTML = hiddenLocally ? `
    <div class="rounded-lg border border-primary/25 bg-primary/10 p-4">
      <div>
        <h3 class="text-sm font-semibold text-primary mb-1">Hidden locally</h3>
        <p class="text-sm text-on-surface-variant">Hidden Results suppress Find Contributions suggestions only. Lookup can still recover this item.</p>
      </div>
    </div>
  ` : '';
  const activityInspectorHTML = isGitHubActivityVisible(issue.github_activity) ? `
    <div class="rounded-lg border border-primary/20 bg-primary/10 p-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-sm font-semibold text-primary mb-1">New GitHub activity</h3>
          <p class="text-sm text-on-surface-variant">${escapeHTML(issue.github_activity.summary || 'Updated on GitHub since last refresh.')}</p>
        </div>
        <button class="action-button shrink-0 px-3 py-1.5 text-xs" id="inspector-mark-reviewed-btn">Mark reviewed</button>
      </div>
    </div>
  ` : '';
  const refreshStatusHTML = inspectorRefreshStatus && inspectorRefreshStatusCardId === issue.id ? `
    <span class="text-xs text-on-surface-variant" id="inspector-refresh-status">${escapeHTML(inspectorRefreshStatus)}</span>
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
      
      <button class="action-button interactive-button-secondary h-8 w-8 p-0" id="inspector-close-btn">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    
    <!-- Scrollable Content Viewport -->
    <div class="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
      
      <!-- Actions buttons inside details -->
      <div class="action-toolbar shrink-0">
        <span class="text-xs text-on-surface-variant">Action center</span>
        <div class="flex flex-wrap gap-2">
          <button class="action-button min-w-fit px-4 py-2 text-xs ${saved ? 'bg-tertiary/10 text-tertiary border-tertiary/30' : 'interactive-button-secondary'}" id="inspector-save-issue-btn">
            <span class="material-symbols-outlined text-[16px]">${saved ? 'check' : 'bookmark'}</span>
            ${saved ? 'Saved to board' : 'Save issue'}
          </button>
          <button class="action-button interactive-button-secondary min-w-fit px-4 py-2 text-xs" id="inspector-hide-issue-btn">
            <span class="material-symbols-outlined text-[16px]">visibility_off</span>
            Hide issue
          </button>
          <button class="action-button interactive-button-secondary min-w-fit px-4 py-2 text-xs" id="inspector-hide-repo-btn">
            <span class="material-symbols-outlined text-[16px]">folder_off</span>
            Hide repo
          </button>
          ${hiddenLocally ? `<button class="action-button interactive-button-secondary min-w-fit px-4 py-2 text-xs" id="inspector-unhide-btn">
            <span class="material-symbols-outlined text-[16px]">visibility</span>
            Unhide
          </button>` : ''}
          <button class="action-button interactive-button-secondary min-w-fit px-4 py-2 text-xs" id="inspector-refresh-card-btn" ${saved ? '' : 'disabled'}>
            <span class="material-symbols-outlined text-[16px]">sync</span>
            Refresh this card
          </button>
          
          ${safeIssueUrl ? `<a class="action-button interactive-button-primary min-w-fit px-4 py-2 text-xs" href="${escapeHTML(safeIssueUrl)}" target="_blank" rel="noopener noreferrer">
            Open on GitHub
            <span class="material-symbols-outlined text-[16px]">open_in_new</span>
          </a>` : '<span class="px-4 py-2 rounded text-xs font-medium border border-outline-variant text-on-surface-variant">GitHub link unavailable</span>'}
        </div>
        ${refreshStatusHTML}
      </div>

      <!-- Description Block -->
      ${closedInspectorHTML}
      ${riskyLookupHTML}
      ${hiddenInspectorHTML}
      ${activityInspectorHTML}
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
      if (isIssueSavedToBoard(issue)) {
        store.setScreen('board');
        return;
      }
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

  const unhideBtn = document.getElementById('inspector-unhide-btn');
  if (unhideBtn) {
    unhideBtn.addEventListener('click', () => {
      const issueKey = getCanonicalIssueKey(issue);
      const repoKey = getCanonicalRepoKey(issue);
      if (issueKey) store.unhideHiddenItem('issue', issueKey);
      if (repoKey) store.unhideHiddenItem('repo', repoKey);
      openInspector();
    });
  }

  const refreshCardBtn = document.getElementById('inspector-refresh-card-btn');
  if (refreshCardBtn) {
    refreshCardBtn.addEventListener('click', async () => {
      const savedCard = findSavedBoardCard(issue);
      if (!savedCard) return;

      inspectorRefreshStatusCardId = issue.id;
      inspectorRefreshStatus = 'Checking GitHub...';
      openInspector();

      try {
        const updatedCard = await refreshSingleSavedBoardCard(savedCard);
        inspectorRefreshStatusCardId = updatedCard.id;
        inspectorRefreshStatus = isGitHubActivityVisible(updatedCard.github_activity)
          ? 'New GitHub activity found.'
          : 'No changes since last refresh.';
        store.setInspectedIssue(updatedCard);
        openInspector();
      } catch (error) {
        inspectorRefreshStatusCardId = issue.id;
        inspectorRefreshStatus = `Refresh failed: ${getSafeRefreshErrorMessage(error)}`;
        openInspector();
      }
    });
  }

  const inspectorMarkReviewedBtn = document.getElementById('inspector-mark-reviewed-btn');
  if (inspectorMarkReviewedBtn) {
    inspectorMarkReviewedBtn.addEventListener('click', () => {
      const updated = store.markGitHubActivityReviewed(issue.id);
      if (updated) {
        store.setInspectedIssue(updated);
      }
      openInspector();
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

  inspectorRefreshStatus = '';
  inspectorRefreshStatusCardId = null;
  panel.classList.add('translate-x-full');
  setTimeout(() => {
    panel.style.display = 'none';
    store.setInspectedIssue(null);
  }, 300);
}
