import { store } from './state/store.js';
import { createGitHubRequestOptions, searchGitHubIssues } from './api/github.js';
import { mockActivePRs, mockSearchIssues } from './data/mockData.js';
import { screenFromHash } from './routing.js';
import { applyFilterPatch, applyPresetSearch } from './searchInteractions.js';
import { escapeHTML, formatDate, getSafeIssueHtmlUrl, safeInteger, safePercent } from './security.js';

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
 * Calculates issue fit score from 0-100
 */
function calculateFitScore(issue) {
  let score = 0;
  const debugLog = [];

  // 1. Labels (+25, -20)
  const labels = (issue.labels || []).map(l => (typeof l === 'object' ? l.name : l).toLowerCase());
  const hasGoodFirstLabel = labels.some(l => l.includes('good first issue') || l.includes('help wanted'));
  if (hasGoodFirstLabel) {
    score += 25;
    debugLog.push("+25 Good first issue / help wanted label");
  }

  const hasStaleLabel = labels.some(l => l.includes('stale') || l.includes('blocked') || l.includes('wontfix'));
  if (hasStaleLabel) {
    score -= 20;
    debugLog.push("-20 Stale / blocked / wontfix labels");
  }

  // 2. Assignee status (+15, -10)
  const isAssigned = issue.assignee || (issue.assignees && issue.assignees.length > 0);
  if (!isAssigned) {
    score += 15;
    debugLog.push("+15 Unassigned");
  } else {
    score -= 10;
    debugLog.push("-10 Assigned");
  }

  // 3. Recency (+15) - updated in the last 7 days
  const updatedAt = new Date(issue.updated_at);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  if (updatedAt > sevenDaysAgo) {
    score += 15;
    debugLog.push("+15 Updated recently (last 7 days)");
  }

  // 4. Comments (+10, -15)
  const commentCount = issue.comments || 0;
  if (commentCount <= 5) {
    score += 10;
    debugLog.push("+10 Low comment count (0-5)");
  } else if (commentCount > 15) {
    score -= 15;
    debugLog.push("-15 Too many comments (>15)");
  }

  // 5. Body useful length (+10)
  const bodyLength = issue.body ? issue.body.length : 0;
  if (bodyLength > 200) {
    score += 10;
    debugLog.push("+10 Issue body has useful length (>200 chars)");
  }

  // 6. Repo stars (+10)
  const starsCount = issue.repository && issue.repository.stargazers_count ? issue.repository.stargazers_count : 0;
  if (starsCount > 1000) {
    score += 10;
    debugLog.push("+10 Repository has stars (>1000)");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    logs: debugLog,
    isAssigned,
    hasGoodFirstLabel,
    hasStaleLabel
  };
}

/**
 * Returns descriptive tag based on fit score
 */
function getFitScoreRating(score) {
  if (score >= 90) return { rating: 'Strong match', colorClass: 'glow-emerald', bgClass: 'bg-tertiary/10 border-tertiary/20 text-tertiary' };
  if (score >= 75) return { rating: 'Good match', colorClass: 'glow-violet', bgClass: 'bg-primary/10 border-primary/20 text-primary' };
  if (score >= 55) return { rating: 'Maybe', colorClass: 'text-on-surface-variant', bgClass: 'bg-surface-container-high text-on-surface-variant border-outline-variant' };
  return { rating: 'Risky', colorClass: 'text-error', bgClass: 'bg-error-container/20 border-error/20 text-error' };
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
        store.setScreen('find-issues');
        searchGitHubIssues(val, true);
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
  const boardConsidering = store.boardCards["Considering"] || [];
  
  // Find current working card on board to resume review
  const workingCards = store.boardCards["Working"] || [];
  const resumeReviewCard = workingCards[0] || (boardConsidering[0] || null);

  let heroHTML = `
    <div class="glass-card rounded-xl p-8 relative overflow-hidden group mb-8">
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="material-symbols-outlined text-primary text-[20px] filled-icon">bolt</span>
            <span class="text-primary font-semibold text-sm tracking-wide uppercase">Next Recommended Action</span>
          </div>
          <h2 class="text-2xl font-headline font-bold text-on-surface tracking-tight mb-2">Configure Personal Access Token</h2>
          <p class="text-on-surface-variant max-w-xl">Configure a Personal Access Token in the Settings panel to increase your GitHub API rate limits and search private repositories seamlessly.</p>
        </div>
        <button class="shrink-0 bg-primary text-on-primary font-medium px-6 py-3 rounded-lg hover:bg-primary-container transition-colors active:scale-95 flex items-center gap-2" id="hero-action-btn">
          Go to Settings
          <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </div>
  `;

  if (resumeReviewCard) {
    const isWorking = workingCards.includes(resumeReviewCard);
    const resumeTitle = escapeHTML(resumeReviewCard.title);
    const resumeRepo = escapeHTML(resumeReviewCard.repository?.full_name || resumeReviewCard.repository?.name || 'github');
    const resumeNumber = safeInteger(resumeReviewCard.number);
    const resumeId = safeInteger(resumeReviewCard.id);
    heroHTML = `
      <div class="glass-card rounded-xl p-8 relative overflow-hidden group mb-8">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-primary text-[20px] filled-icon">bolt</span>
              <span class="text-primary font-semibold text-sm tracking-wide uppercase">${isWorking ? 'Active Assignment' : 'Next Recommended Action'}</span>
            </div>
            <h2 class="text-2xl font-headline font-bold text-on-surface tracking-tight mb-2">${isWorking ? 'Resume Working: ' : 'Read Docs: '}${resumeTitle}</h2>
            <p class="text-on-surface-variant max-w-xl">${resumeRepo} #${resumeNumber} - You tagged this card in your Contribution Board. Open it to proceed with tasks.</p>
          </div>
          <button class="shrink-0 bg-primary text-on-primary font-medium px-6 py-3 rounded-lg hover:bg-primary-container transition-colors active:scale-95 flex items-center gap-2" id="hero-resume-btn" data-id="${resumeId}">
            Resume Review
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  }

  // Saved Issues lists the Board Considering lane (or mocks if empty)
  let savedIssuesHTML = '';
  if (boardConsidering.length === 0) {
    savedIssuesHTML = `
      <div class="p-6 rounded-lg bg-surface-container-lowest border border-outline-variant text-center flex flex-col items-center justify-center gap-2 py-10">
        <span class="material-symbols-outlined text-on-surface-variant text-3xl">bookmarks</span>
        <h4 class="text-on-surface font-medium">No saved issues</h4>
        <p class="text-xs text-on-surface-variant max-w-xs">Save issues from "Find Issues" search results to see them listed in your Dashboard panel.</p>
        <button class="mt-2 px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-semibold hover:bg-primary-container" id="dash-go-find-btn">Browse Issues</button>
      </div>
    `;
  } else {
    savedIssuesHTML = boardConsidering.slice(0, 3).map(issue => {
      const { score } = calculateFitScore(issue);
      const rating = getFitScoreRating(score);
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
            <div class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${rating.bgClass}">
              <span class="w-1.5 h-1.5 rounded-full ${score >= 75 ? 'bg-tertiary animate-pulse' : 'bg-outline'}"></span>
              ${score}% Match
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

  // Active PRs lists the active mock items
  const activePRsHTML = mockActivePRs.map(pr => {
    let prIcon = 'adjust';
    let prColor = 'text-tertiary';
    let prBg = 'bg-surface-container-high';
    let statusText = pr.state;

    if (pr.status === 'draft') {
      prIcon = 'edit_note';
      prColor = 'text-on-surface-variant';
    } else if (pr.status === 'error') {
      prIcon = 'unpublished';
      prColor = 'text-error';
      prBg = 'bg-error/10 border-error/20';
      statusText = 'Changes Requested';
    }

    return `
      <div class="flex items-start gap-4">
        <div class="w-8 h-8 rounded border border-outline-variant flex items-center justify-center shrink-0 mt-1 ${prBg}">
          <span class="material-symbols-outlined ${prColor} text-[18px]">${prIcon}</span>
        </div>
        <div>
          <h4 class="text-sm font-medium text-on-surface hover:text-primary cursor-pointer mb-0.5 pr-link-card" data-repo="${escapeHTML(pr.repository)}" data-num="${safeInteger(pr.number)}">${escapeHTML(pr.title)}</h4>
          <div class="flex items-center gap-2 text-xs">
            <span class="text-on-surface-variant font-mono">${escapeHTML(pr.repository)} #${safeInteger(pr.number)}</span>
            <span class="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span class="${prColor} font-medium">${escapeHTML(statusText)}</span>
            <span class="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span class="text-on-surface-variant">${escapeHTML(pr.reviews)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <section class="p-6 md:p-8">
      <div class="max-w-7xl mx-auto">
        
        <!-- Hero Recommended Section -->
        ${heroHTML}
        
        <!-- Stats Row -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="bg-surface-container rounded-lg border border-outline-variant p-6 flex flex-col gap-2 hover:bg-surface-container-high transition-colors">
            <div class="flex justify-between items-start">
              <span class="text-on-surface-variant text-sm font-medium">PRs Merged (30d)</span>
              <span class="material-symbols-outlined text-tertiary">merge</span>
            </div>
            <div class="flex items-end gap-3 mt-2">
              <span class="text-4xl font-headline font-bold text-on-surface">24</span>
              <span class="text-tertiary text-sm font-medium mb-1 flex items-center"><span class="material-symbols-outlined text-[16px]">arrow_upward</span> 12%</span>
            </div>
          </div>
          
          <div class="bg-surface-container rounded-lg border border-outline-variant p-6 flex flex-col gap-2 hover:bg-surface-container-high transition-colors">
            <div class="flex justify-between items-start">
              <span class="text-on-surface-variant text-sm font-medium">Issues Solved</span>
              <span class="material-symbols-outlined text-primary">bug_report</span>
            </div>
            <div class="flex items-end gap-3 mt-2">
              <span class="text-4xl font-headline font-bold text-on-surface">18</span>
              <span class="text-on-surface-variant text-sm mb-1">Total this month</span>
            </div>
          </div>
          
          <div class="bg-surface-container rounded-lg border border-outline-variant p-6 flex flex-col gap-2 hover:bg-surface-container-high transition-colors">
            <div class="flex justify-between items-start">
              <span class="text-on-surface-variant text-sm font-medium">Current Streak</span>
              <span class="material-symbols-outlined text-tertiary filled-icon">local_fire_department</span>
            </div>
            <div class="flex items-end gap-3 mt-2">
              <span class="text-4xl font-headline font-bold text-on-surface">14</span>
              <span class="text-on-surface-variant text-sm mb-1">Days active</span>
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
          
          <!-- Active PRs -->
          <div class="bento-item bg-surface-container border border-outline-variant p-6 flex flex-col gap-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-headline font-bold text-on-surface tracking-tight flex items-center gap-2">
                <span class="material-symbols-outlined text-on-surface-variant">commit</span>
                Active PRs
              </h3>
            </div>
            <div class="flex flex-col gap-4">
              ${activePRsHTML}
            </div>
            <button class="mt-auto w-full py-2 border border-outline-variant rounded bg-surface-container-lowest text-on-surface-variant text-sm hover:bg-surface-container-high hover:text-on-surface transition-colors font-medium" id="dash-view-prs-btn">
              View All Pull Requests
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

  const prsBtn = document.getElementById('dash-view-prs-btn');
  if (prsBtn) {
    prsBtn.addEventListener('click', () => {
      store.setScreen('board'); // Board contains PR columns
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
function renderFindIssues(container) {
  const results = store.searchResults;
  const loading = store.searchLoading;
  const error = store.searchError;
  const filters = store.filters;

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
        
        ${results ? renderIssueCardsList(results) : ''}
      </div>
    `;
    countText = results ? `Showing ${results.length} issues` : 'Request failed';
  } else if (results !== null) {
    countText = `Showing ${results.length} issues`;
    if (results.length === 0) {
      resultsHTML = `
        <div class="p-12 rounded-lg bg-surface-container border border-outline-variant text-center flex flex-col items-center justify-center gap-3 py-20">
          <span class="material-symbols-outlined text-on-surface-variant text-4xl">search_off</span>
          <h3 class="text-on-surface font-medium text-lg">No matching issues found</h3>
          <p class="text-sm text-on-surface-variant max-w-sm">Try broadening your labels list, checking other languages, or lowering the minimum stars threshold.</p>
        </div>
      `;
    } else {
      resultsHTML = renderIssueCardsList(results);
    }
  } else {
    // Initial screen state - explain Token details
    const token = store.githubToken;
    countText = 'Suggested starter issues';
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
      ${renderIssueCardsList(mockSearchIssues)}
    `;
  }

  container.innerHTML = `
    <!-- Find Issues layout -->
    <div class="bg-background flex min-h-[calc(100vh-3.5rem)] flex-col relative hide-scrollbar">
      
      <!-- Command Palette Search Hero -->
      <section class="w-full pt-12 pb-8 px-6 md:px-8 border-b border-outline-variant/30 bg-surface-container-lowest relative">
        <div class="max-w-3xl mx-auto relative z-10">
          <h1 class="text-3xl font-headline font-bold text-on-surface mb-6 tracking-tight text-center">Find your next contribution</h1>
          
          <!-- Command Bar -->
          <div class="flex gap-3">
            <div class="relative flex-1 group">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span class="material-symbols-outlined text-primary text-xl group-focus-within:text-tertiary transition-colors">search</span>
              </div>
              <input class="block w-full pl-12 pr-4 py-3.5 bg-surface-container border border-outline-variant rounded-xl text-base text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" id="search-keyword-input" placeholder="Search issues, labels, or repositories..." type="text" value="${escapeHTML(store.searchQuery)}"/>
            </div>
            <button class="px-6 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary-container transition-colors active:scale-95 shrink-0" id="search-trigger-btn">
              Search
            </button>
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
          </div>
        </div>
      </section>
      
      <!-- Main Workspace: Filters + Results -->
      <div class="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-8">
        
        <!-- Left Sidebar Filters -->
        <aside class="w-full lg:w-56 shrink-0 flex flex-col gap-6" id="find-issues-sidebar">
          
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
      searchGitHubIssues(store.searchQuery, true);
    });
  }

  const triggerBtn = document.getElementById('search-trigger-btn');
  const keywordInput = document.getElementById('search-keyword-input');
  if (triggerBtn && keywordInput) {
    triggerBtn.addEventListener('click', () => {
      const val = keywordInput.value.trim();
      store.setSearchQuery(val);
      searchGitHubIssues(val, true);
    });
    keywordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = keywordInput.value.trim();
        store.setSearchQuery(val);
        searchGitHubIssues(val, true);
      }
    });
  }

  // Preset quick filters
  document.querySelectorAll('.preset-search-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      applyPresetSearch(store, preset, searchGitHubIssues);
    });
  });

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
  let sorted = [...issuesList];
  
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
    const repoName = escapeHTML(issue.repository?.full_name || issue.repository?.name || 'github');
    const isFeatured = index === 0 && sorted.length > 1;
    const updatedText = escapeHTML(formatDate(issue.updated_at));
    const stars = issue.repository && issue.repository.stargazers_count ? issue.repository.stargazers_count : 0;
    const starsText = stars >= 1000 ? `${(stars / 1000).toFixed(stars >= 10000 ? 0 : 1)}k` : `${stars}`;
    const issueId = safeInteger(issue.id);
    const issueNumber = safeInteger(issue.number);
    const issueComments = safeInteger(issue.comments);
    const issueTitle = escapeHTML(issue.title);
    const issueBody = escapeHTML(issue.body || 'No summary description provided.');
    const issueUrl = getSafeIssueHtmlUrl(issue);

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
        
        <div class="mt-auto flex flex-wrap items-center gap-2">
          ${labelsHTML}
          <span class="rounded border ${rating.bgClass} px-2 py-0.5 text-xs">${fitObj.score}% Match</span>
        </div>
        
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/40 pt-4">
          <div class="flex items-center gap-4 text-xs text-on-surface-variant">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">star</span>${starsText}</span>
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
      const items = store.searchResults || mockSearchIssues;
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
      const items = store.searchResults || mockSearchIssues;
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
      const items = store.searchResults || mockSearchIssues;
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
      const items = store.searchResults || mockSearchIssues;
      const issue = items.find(i => i.id === issueId);
      if (issue) {
        store.saveIssueToBoard(issue);
        // Toast / alert indicator
        btn.innerHTML = `<span class="material-symbols-outlined text-[14px]">check</span> Saved`;
        btn.classList.add('bg-tertiary/10', 'text-tertiary', 'border-tertiary/20');
        btn.classList.remove('bg-transparent', 'text-on-surface-variant', 'border-outline-variant');
      }
    });
  });
}

/**
 * 3. KANBAN BOARD VIEW
 */
function renderBoard(container) {
  const cols = ['Considering', 'Read Docs', 'Asked Maintainer', 'Working', 'PR Open', 'Merged', 'Passed'];
  
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
            <span class="text-[10px] text-on-surface-variant">Checks passing</span>
            <span class="material-symbols-outlined text-tertiary text-[14px] filled-icon">check_circle</span>
          </div>
        `;
      }

      // Special tags for Merged
      let mergedTextHTML = '';
      if (col === 'Merged') {
        mergedTextHTML = `
          <div class="flex justify-between items-center text-[10px] text-on-surface-variant mt-2">
            <span>Merged by core-team</span>
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
        <div class="kanban-card bg-surface-container border border-outline-variant rounded-lg p-4 cursor-pointer group mb-3 relative board-card-item" data-id="${cardId}">
          <button class="absolute top-2 right-2 text-on-surface-variant hover:text-error bg-transparent border-none delete-card-btn" data-id="${cardId}" style="padding:2px;"><span class="material-symbols-outlined text-[14px]">close</span></button>
          
          <div class="flex justify-between items-start mb-2 pr-4">
            <span class="text-[11px] font-medium text-on-surface-variant uppercase tracking-wide flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px] filled-icon">bookmark</span>
              ${repoName}
            </span>
            <span class="text-xs text-on-surface-variant group-hover:text-primary transition-colors">#${cardNumber}</span>
          </div>
          
          <h4 class="text-sm font-medium text-on-surface leading-snug mb-3 ${col === 'Merged' ? 'line-through opacity-70' : ''}">${cardTitle}</h4>
          
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
      <div class="px-6 md:px-8 py-5 border-b border-outline-variant flex-shrink-0 flex justify-between items-center bg-surface-container-lowest">
        <div>
          <h1 class="text-2xl font-headline font-bold text-on-surface mb-1">Contribution Board</h1>
          <p class="text-sm text-on-surface-variant">Tracking open-source PRs and active issues across repositories.</p>
        </div>
        
        <div class="flex items-center gap-3">
          <!-- Reset button for ease -->
          <button class="flex items-center gap-2 bg-surface-container border border-outline-variant hover:border-outline text-on-surface text-sm font-medium py-1.5 px-3 rounded transition-all" id="board-reset-btn">
            <span class="material-symbols-outlined text-[16px]">restart_alt</span> Reset Board
          </button>
        </div>
      </div>
      
      <!-- Scrollable Kanban Area -->
      <div class="flex-1 overflow-x-auto overflow-y-hidden p-6 md:p-8">
        <div class="flex h-full gap-6 items-start pb-4 min-w-max">
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

  // Board Checklist items change state
  document.querySelectorAll('.board-task-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const cardId = parseInt(cb.getAttribute('data-cardid'), 10);
      const taskText = cb.getAttribute('data-task');
      store.toggleTaskChecklist(cardId, taskText, cb.checked);
    });
  });

  // Reset board mock data
  const resetBtn = document.getElementById('board-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem('pr_dashboard_board_cards');
      location.reload();
    });
  }
}

/**
 * 4. SETTINGS VIEW
 */
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
        
        <!-- Danger Zone -->
        <div class="pt-8 border-t border-outline-variant space-y-4">
          <h3 class="text-sm font-semibold text-error uppercase tracking-wider">Danger Zone</h3>
          <div class="flex items-center justify-between p-5 rounded-lg border border-error/20 bg-error-container/10">
            <div>
              <div class="font-medium text-on-surface mb-1">Clear local storage</div>
              <div class="text-sm text-on-surface-variant">Permanently remove your token and connection settings from this browser.</div>
            </div>
            <button class="px-4 py-2 rounded-lg border border-error text-error hover:bg-error-container/50 transition-colors font-medium text-sm whitespace-nowrap" id="clear-settings-btn">
              Clear Data
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
  const clearBtn = document.getElementById('clear-settings-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
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
}

/**
 * 5. DETAILS INSPECTOR DRAW PANEL VIEW
 */
function openInspector() {
  const panel = document.getElementById('inspector-overlay-drawer');
  if (!panel) return;

  const issue = store.inspectedIssue;
  if (!issue) return;

  const { score, logs } = calculateFitScore(issue);
  const rating = getFitScoreRating(score);
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

  // Render match score explanations
  const fitScoreReasonsHTML = logs.map(log => {
    return `
      <li class="flex items-start gap-2 text-sm text-on-surface-variant">
        <span class="material-symbols-outlined text-tertiary text-[16px] mt-0.5 filled-icon">check</span>
        <span>${escapeHTML(log)}</span>
      </li>
    `;
  }).join('');

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
          <div class="flex items-center gap-1.5 text-tertiary">
            <span class="material-symbols-outlined text-[18px] filled-icon">check_circle</span>
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
          
          ${safeIssueUrl ? `<a class="px-4 py-2 bg-primary text-on-primary rounded text-xs font-medium hover:bg-primary-container transition-colors flex items-center gap-1.5" href="${escapeHTML(safeIssueUrl)}" target="_blank" rel="noopener noreferrer">
            Open on GitHub
            <span class="material-symbols-outlined text-[16px]">open_in_new</span>
          </a>` : '<span class="px-4 py-2 rounded text-xs font-medium border border-outline-variant text-on-surface-variant">GitHub link unavailable</span>'}
        </div>
      </div>

      <!-- Description Block -->
      <section class="bg-surface-container rounded-lg border border-outline-variant p-5">
        <h3 class="text-base font-headline font-semibold text-on-background mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">description</span>
          Issue Description
        </h3>
        <div class="prose prose-invert text-xs text-on-surface-variant font-body leading-relaxed whitespace-pre-wrap select-text">${safeIssueBody}</div>
      </section>
      
      <!-- Fit Details & Analytics Bento -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
        
        <!-- Score Fit Analysis -->
        <div class="bg-surface-container rounded-lg border border-outline-variant p-4 relative overflow-hidden group">
          <h4 class="text-xs font-headline font-semibold text-on-background mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[18px]">radar</span>
            Why this fits
          </h4>
          <ul class="space-y-2">
            ${fitScoreReasonsHTML}
          </ul>
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
      store.saveIssueToBoard(issue);
      saveBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">check</span> Saved to board`;
      saveBtn.classList.add('bg-tertiary/10', 'text-tertiary', 'border-tertiary/30');
      saveBtn.classList.remove('bg-surface-container', 'border-outline-variant', 'text-on-surface');
      // Trigger a re-render of active screen (Find Issues cards list or Dashboard) to reflect Saved status
      renderActiveScreen();
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
