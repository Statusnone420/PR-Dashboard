const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const constantsPromise = import('../src/boardConstants.js');

const layoutPort = process.env.PR_DASHBOARD_LAYOUT_PORT || '3000';
const baseURL = process.env.PR_DASHBOARD_BASE_URL || `http://127.0.0.1:${layoutPort}`;
const screenshotDir = 'D:/PR Dashboard/qa_screenshots/board-layout-a1';

const viewports = [
  { width: 390, height: 844, file: 'board-a1-390x844.png', mobile: true },
  { width: 375, height: 667, file: 'board-a1-375x667.png', mobile: true },
  { width: 1090, height: 1212, file: 'board-a1-1090x1212.png', expectedColumns: 2 },
  { width: 1366, height: 768, file: 'board-a1-1366x768.png', expectedColumns: 3 },
  { width: 1920, height: 1080, file: 'board-a1-1920x1080.png', mobile: false },
  { width: 3440, height: 1440, file: 'board-a1-3440x1440.png', mobile: false }
];

const inspectorViewports = [
  { width: 1024, height: 768, file: 'inspector-polish-1024x768.png' },
  { width: 1366, height: 768, file: 'inspector-polish-1366x768.png' },
  { width: 1920, height: 1080, file: 'inspector-polish-1920x1080.png' },
  { width: 3440, height: 1440, file: 'inspector-polish-3440x1440.png' }
];

function card(id, column, index, overrides = {}) {
  return {
    id,
    number: id,
    title: `${column} card ${index}`,
    body: 'Seeded by board layout smoke.',
    updated_at: '2026-05-22T10:00:00.000Z',
    saved_at: '2026-05-22T09:00:00.000Z',
    last_moved_at: '2026-05-22T09:00:00.000Z',
    column_entered_at: '2026-05-22T09:00:00.000Z',
    comments: 2,
    labels: [{ name: 'help wanted' }],
    repository: { full_name: 'TEAMMATES/teammates', name: 'teammates' },
    html_url: `https://github.com/TEAMMATES/teammates/issues/${id}`,
    ...overrides
  };
}

async function mockInspectorGitHub(page, options = {}) {
  let releaseIssueRefresh = () => {};
  const issueRefreshHold = new Promise(resolve => {
    releaseIssueRefresh = resolve;
  });

  await page.route('https://api.github.com/**', async route => {
    const url = route.request().url();
    const isHeldIssueRefresh = options.holdIssueRefresh
      && /\/repos\/[^/]+\/[^/]+\/issues\/1000(?:\?|$)/.test(url);

    if (isHeldIssueRefresh) {
      await issueRefreshHold;
    }

    const body = isHeldIssueRefresh
      ? JSON.stringify({
        id: 1000,
        number: 1000,
        title: '[Bounty $5k] [CLI] Validate logs tail is non-negative - logs arguments',
        body: 'Seeded by board layout smoke.',
        state: 'open',
        comments: 2,
        labels: [{ name: 'help wanted' }],
        updated_at: '2026-05-24T10:00:00.000Z',
        html_url: 'https://github.com/TEAMMATES/teammates/issues/1000',
        repository_url: 'https://api.github.com/repos/TEAMMATES/teammates',
        user: { login: 'layout-smoke' }
      })
      : url.includes('/search/issues')
      ? JSON.stringify({ items: [] })
      : JSON.stringify([]);

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-resource': url.includes('/search/') ? 'search' : 'core',
        'x-ratelimit-limit': url.includes('/search/') ? '30' : '5000',
        'x-ratelimit-remaining': url.includes('/search/') ? '29' : '4990',
        'x-ratelimit-used': url.includes('/search/') ? '1' : '10',
        'x-ratelimit-reset': '1770000000'
      },
      body
    });
  });

  return { releaseIssueRefresh };
}

function seededBoard() {
  return {
    Considering: Array.from({ length: 5 }, (_, index) => card(1000 + index, 'Considering', index + 1, index === 0 ? {
      title: '[Bounty $5k] [CLI] Validate logs tail is non-negative - logs arguments',
      repository: { full_name: 'ORCHESTRATION-AGENT/AGENTORCHESTRATOR', name: 'AGENTORCHESTRATOR' }
    } : {})),
    'Read Docs': Array.from({ length: 4 }, (_, index) => card(1100 + index, 'Read Docs', index + 1)),
    'Asked Maintainer': Array.from({ length: 6 }, (_, index) => card(1200 + index, 'Asked Maintainer', index + 1, index === 0 ? {
      github_activity: {
        has_new_activity: true,
        last_checked_at: '2026-05-22T10:00:00.000Z',
        summary: '4 new comments since last refresh.'
      }
    } : {})),
    Working: Array.from({ length: 5 }, (_, index) => card(1300 + index, 'Working', index + 1)),
    'PR Open': Array.from({ length: 3 }, (_, index) => card(1400 + index, 'PR Open', index + 1)),
    Merged: Array.from({ length: 2 }, (_, index) => card(1500 + index, 'Merged', index + 1)),
    Passed: Array.from({ length: 2 }, (_, index) => card(1600 + index, 'Passed', index + 1, { state: 'closed' }))
  };
}

function seededCrowdedBoard() {
  return {
    Considering: Array.from({ length: 35 }, (_, index) => card(2000 + index, 'Considering', index + 1, index === 0 ? {
      title: '[Bounty $5k] [CLI] Validate logs tail is non-negative - logs arguments',
      repository: { full_name: 'ORCHESTRATION-AGENT/AGENTORCHESTRATOR', name: 'AGENTORCHESTRATOR' }
    } : {})),
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: []
  };
}

function seededCompactCrowdedBoard() {
  const longRepo = 'very-long-owner-name/very-long-repository-name-with-platform-filter-board-polish';
  const longTitle = 'Compact board candidate with an unusually long issue title that still needs visible workflow actions and lane context';
  return {
    Considering: Array.from({ length: 14 }, (_, index) => card(3000 + index, 'Considering', index + 1, {
      title: `${longTitle} ${index + 1}`,
      repository: { full_name: longRepo, name: 'platform-filter-board-polish' }
    })),
    'Read Docs': Array.from({ length: 8 }, (_, index) => card(3100 + index, 'Read Docs', index + 1, {
      title: `${longTitle} read-docs ${index + 1}`,
      repository: { full_name: longRepo, name: 'platform-filter-board-polish' }
    })),
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: Array.from({ length: 12 }, (_, index) => card(3200 + index, 'Merged', index + 1, {
      title: `${longTitle} merged ${index + 1}`,
      repository: { full_name: longRepo, name: 'platform-filter-board-polish' }
    })),
    Passed: Array.from({ length: 18 }, (_, index) => card(3300 + index, 'Passed', index + 1, {
      state: 'closed',
      title: `${longTitle} passed ${index + 1}`,
      repository: { full_name: longRepo, name: 'platform-filter-board-polish' }
    }))
  };
}

test.describe('A1 board layout', () => {
  test('valid routes render content without runtime errors', async ({ context }) => {
    const routes = [
      { path: '/', expectedText: 'Saved candidates' },
      { path: '/#dashboard', expectedText: 'Saved candidates' },
      { path: '/#find-issues', expectedText: 'Find your next contribution' },
      { path: '/#board', expectedText: 'Active workflow' },
      { path: '/#settings', expectedText: 'GitHub token' },
      { path: '/#profile', expectedText: 'Profile' },
      { path: '/#help', expectedText: 'Board workflow basics' },
      { path: '/#feedback', expectedText: 'Report feedback' }
    ];

    for (const route of routes) {
      const page = await context.newPage();
      const runtimeErrors = [];
      page.on('console', message => {
        if (['error', 'warning'].includes(message.type())) {
          runtimeErrors.push(`console ${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', error => {
        runtimeErrors.push(`pageerror: ${error.message}`);
      });

      await page.goto(`${baseURL}${route.path}`);
      const content = page.locator('#app-content');
      await expect(content).toContainText(route.expectedText);

      const contentMetrics = await content.evaluate(element => ({
        childCount: element.children.length,
        textLength: element.innerText.trim().length
      }));
      await page.waitForTimeout(100);
      expect(contentMetrics.childCount, `${route.path} should render route children`).toBeGreaterThan(0);
      expect(contentMetrics.textLength, `${route.path} should render meaningful route text`).toBeGreaterThan(50);
      expect(runtimeErrors, `${route.path} should not emit console or page errors`).toEqual([]);

      await page.close();
    }
  });

  test('API limits popover opens, checks limits, and closes without horizontal overflow', async ({ page }) => {
    let rateLimitRequestCount = 0;
    await page.route('https://api.github.com/rate_limit', async route => {
      rateLimitRequestCount += 1;
      const searchRemaining = rateLimitRequestCount === 1 ? 29 : 1;
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resources: {
            core: { limit: 5000, remaining: 4995, used: 5, reset: 1770000000 },
            search: { limit: 30, remaining: searchRemaining, used: 30 - searchRemaining, reset: 1770000300 }
          }
        })
      });
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseURL}/#dashboard`);
    await expect(page.locator('#api-limits-trigger')).toBeVisible();
    await expect(page.locator('#api-limits-popover')).toBeHidden();

    await page.locator('#api-limits-trigger').click();
    await expect(page.locator('#api-limits-popover')).toBeVisible();
    await page.locator('#api-limits-check-btn').click();
    await expect(page.locator('#api-limits-core-row')).toContainText('4,995 / 5,000');
    await expect(page.locator('#api-limits-search-row')).toContainText('29 / 30');

    let widths = await page.evaluate(() => ({
      core: parseFloat(document.querySelector('#api-limits-core-row .api-limit-progress-fill').style.width),
      search: parseFloat(document.querySelector('#api-limits-search-row .api-limit-progress-fill').style.width)
    }));
    expect(widths.core).toBeGreaterThan(99.8);
    expect(widths.core).toBeLessThan(100);
    expect(widths.search).toBeGreaterThan(96.6);
    expect(widths.search).toBeLessThan(96.8);

    let metrics = await page.evaluate(() => ({
      documentHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      popoverHorizontalOverflow: document.getElementById('api-limits-popover').scrollWidth > document.getElementById('api-limits-popover').clientWidth + 1
    }));
    expect(metrics.documentHorizontalOverflow).toBe(false);
    expect(metrics.popoverHorizontalOverflow).toBe(false);

    await page.locator('#api-limits-check-btn').click();
    await expect(page.locator('#api-limits-search-row')).toContainText('1 / 30');
    widths = await page.evaluate(() => ({
      search: parseFloat(document.querySelector('#api-limits-search-row .api-limit-progress-fill').style.width)
    }));
    expect(widths.search).toBeGreaterThan(3.2);
    expect(widths.search).toBeLessThan(3.5);

    const fillStyles = await page.evaluate(() => {
      const searchTrack = document.querySelector('#api-limits-search-row .api-limit-progress-track');
      const searchFill = document.querySelector('#api-limits-search-row .api-limit-progress-fill');
      const coreTrack = document.querySelector('#api-limits-core-row .api-limit-progress-track');
      const coreFill = document.querySelector('#api-limits-core-row .api-limit-progress-fill');
      return {
        searchLevel: searchFill.getAttribute('data-limit-level'),
        searchFillBackground: getComputedStyle(searchFill).backgroundColor,
        searchTrackBackground: getComputedStyle(searchTrack).backgroundColor,
        coreLevel: coreFill.getAttribute('data-limit-level'),
        coreFillBackground: getComputedStyle(coreFill).backgroundColor,
        coreTrackBackground: getComputedStyle(coreTrack).backgroundColor
      };
    });
    expect(fillStyles.searchLevel).toBe('critical');
    expect(fillStyles.coreLevel).toBe('healthy');
    expect(fillStyles.searchFillBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(fillStyles.coreFillBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(fillStyles.searchFillBackground).not.toBe(fillStyles.searchTrackBackground);
    expect(fillStyles.coreFillBackground).not.toBe(fillStyles.coreTrackBackground);

    await page.keyboard.press('Escape');
    await expect(page.locator('#api-limits-popover')).toBeHidden();

    await page.locator('#api-limits-trigger').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#api-limits-popover')).toBeVisible();

    await page.mouse.click(20, 20);
    await expect(page.locator('#api-limits-popover')).toBeHidden();
  });

  test('desktop find filters keep detailed controls visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseURL}/#find-issues`);

    const sidebar = page.locator('#find-issues-sidebar');
    await expect(sidebar.getByRole('heading', { name: 'Language' })).toBeVisible();
    await expect(sidebar.getByRole('heading', { name: 'Labels' })).toBeVisible();
    await expect(sidebar.getByRole('heading', { name: 'Stars' })).toBeVisible();
    await expect(sidebar.locator('.lang-filter-checkbox').first()).toBeVisible();

    const metrics = await page.evaluate(() => {
      const disclosure = document.getElementById('mobile-filter-disclosure');
      const summary = disclosure.querySelector('.mobile-filter-summary');
      const body = disclosure.querySelector('.mobile-filter-body');
      return {
        bodyDisplay: getComputedStyle(body).display,
        bodyHeight: body.getBoundingClientRect().height,
        summaryDisplay: getComputedStyle(summary).display
      };
    });
    expect(metrics.bodyDisplay).not.toBe('none');
    expect(metrics.bodyHeight).toBeGreaterThan(0);
    expect(metrics.summaryDisplay).toBe('none');
  });

  test('mobile audit controls expose API limits, touch targets, collapsed filters, and tooltip dismissal', async ({ page }) => {
    await page.route('https://api.github.com/rate_limit', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resources: {
            core: { limit: 5000, remaining: 4990, used: 10, reset: 1770000000 },
            search: { limit: 30, remaining: 24, used: 6, reset: 1770000300 }
          }
        })
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/#dashboard`);

    await page.locator('#btn-settings').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#btn-settings')).toHaveAttribute('data-tooltip-suppressed', 'true');

    await page.locator('#mobile-menu-toggle').click();
    await expect(page.locator('#mobile-api-limits-trigger')).toBeVisible();
    await page.locator('#mobile-api-limits-trigger').click();
    await expect(page.locator('#mobile-api-limits-popover')).toBeVisible();
    await page.locator('#mobile-api-limits-check-btn').click();
    await expect(page.locator('#mobile-api-limits-core-row')).toContainText('4,990 / 5,000');
    await expect(page.locator('#mobile-api-limits-search-row')).toContainText('24 / 30');
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-api-limits-popover')).toBeHidden();

    const touchTargets = await page.evaluate(() => {
      const ids = [
        'mobile-menu-toggle',
        'mobile-menu-close',
        'btn-notifications',
        'btn-settings',
        'user-profile-avatar',
        'mobile-api-limits-trigger'
      ];
      return ids.map(id => {
        const rect = document.getElementById(id).getBoundingClientRect();
        return { id, width: rect.width, height: rect.height };
      });
    });
    for (const target of touchTargets) {
      expect(target.width, `${target.id} width`).toBeGreaterThanOrEqual(44);
      expect(target.height, `${target.id} height`).toBeGreaterThanOrEqual(44);
    }

    await page.locator('#mobile-menu-close').click();
    await page.goto(`${baseURL}/#find-issues`);
    await expect(page.locator('#mobile-filter-disclosure')).toBeVisible();

    let metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const results = document.getElementById('find-results-panel').getBoundingClientRect();
      const filters = document.getElementById('mobile-filter-disclosure').getBoundingClientRect();
      const body = document.querySelector('#mobile-filter-disclosure .mobile-filter-body');
      return {
        documentHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
        filtersOpen: document.getElementById('mobile-filter-disclosure').open,
        bodyVisible: body && getComputedStyle(body).display !== 'none',
        resultsBeforeFilters: results.top < filters.top
      };
    });
    expect(metrics.documentHorizontalOverflow).toBe(false);
    expect(metrics.filtersOpen).toBe(false);
    expect(metrics.bodyVisible).toBe(false);
    expect(metrics.resultsBeforeFilters).toBe(true);

    await page.locator('#mobile-filter-disclosure > summary').click();
    metrics = await page.evaluate(() => {
      const body = document.querySelector('#mobile-filter-disclosure .mobile-filter-body');
      return {
        filtersOpen: document.getElementById('mobile-filter-disclosure').open,
        bodyVisible: body && getComputedStyle(body).display !== 'none',
        documentHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      };
    });
    expect(metrics.filtersOpen).toBe(true);
    expect(metrics.bodyVisible).toBe(true);
    expect(metrics.documentHorizontalOverflow).toBe(false);
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((board) => {
      localStorage.setItem('pr_dashboard_board_cards', JSON.stringify(board));
    }, seededBoard());
  });

  for (const viewport of viewports) {
    test(`fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const { BOARD_LAYOUT_MAX_WIDTH } = await constantsPromise;
      await fs.mkdir(screenshotDir, { recursive: true });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${baseURL}/#board`);
      await expect(page.locator('[data-board-section="active"]')).toBeVisible();
      await expect(page.locator('[data-board-section="completed"]')).toBeVisible();
      await expect(page.locator('.board-active-grid .kanban-column')).toHaveCount(5);
      await expect(page.locator('.board-completed-grid .kanban-column')).toHaveCount(2);

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const active = document.querySelector('[data-board-section="active"]');
        const completed = document.querySelector('[data-board-section="completed"]');
        const body = document.querySelector('.board-page-body');
        const activeGrid = document.querySelector('.board-active-grid');
        const firstLane = document.querySelector('.board-active-grid .kanban-column:nth-child(1)');
        const secondLane = document.querySelector('.board-active-grid .kanban-column:nth-child(2)');
        const activeRect = active.getBoundingClientRect();
        const completedRect = completed.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const firstLaneRect = firstLane.getBoundingClientRect();
        const secondLaneRect = secondLane.getBoundingClientRect();
        const firstCard = document.querySelector('.board-active-grid .kanban-card');
        const firstCardRect = firstCard.getBoundingClientRect();
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
          activeTop: activeRect.top,
          activeBottom: activeRect.bottom,
          activeHeight: activeRect.height,
          activeWidth: activeRect.width,
          activeCenter: activeRect.left + activeRect.width / 2,
          boardBodyWidth: bodyRect.width,
          boardBodyCenter: bodyRect.left + bodyRect.width / 2,
          completedTop: completedRect.top,
          completedHeight: completedRect.height,
          firstLaneTop: firstLaneRect.top,
          secondLaneTop: secondLaneRect.top,
          firstCardWidth: firstCardRect.width,
          horizontalOverflowItems: Array.from(document.querySelectorAll(
            '.board-lane-cards-container, .kanban-column, .kanban-card'
          ))
            .filter(element => element.scrollWidth > element.clientWidth + 1)
            .map(element => ({
              className: element.className,
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
              text: element.textContent.trim().slice(0, 80)
            })),
          activeGridColumns: getComputedStyle(activeGrid).gridTemplateColumns.split(' ').filter(Boolean).length,
          viewportWidth: window.innerWidth
        };
      });

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
      expect(metrics.horizontalOverflowItems).toEqual([]);
      expect(metrics.completedTop).toBeGreaterThan(metrics.activeTop);

      if (viewport.mobile) {
        expect(metrics.secondLaneTop).toBeGreaterThan(metrics.firstLaneTop);
        expect(metrics.activeGridColumns).toBe(1);
      } else if (viewport.expectedColumns) {
        expect(metrics.activeGridColumns).toBe(viewport.expectedColumns);
        expect(metrics.secondLaneTop).toBe(metrics.firstLaneTop);
        expect(metrics.activeHeight).toBeGreaterThan(metrics.completedHeight);
        expect(metrics.activeWidth).toBeGreaterThan(metrics.boardBodyWidth * 0.9);
        expect(metrics.firstCardWidth).toBeGreaterThanOrEqual(280);
      } else {
        expect(metrics.activeGridColumns).toBe(5);
        expect(metrics.activeHeight).toBeGreaterThan(metrics.completedHeight);
        expect(metrics.activeWidth).toBeGreaterThan(Math.min(metrics.boardBodyWidth, BOARD_LAYOUT_MAX_WIDTH) * 0.9);
        expect(metrics.activeWidth).toBeLessThanOrEqual(BOARD_LAYOUT_MAX_WIDTH + 2);
        expect(Math.abs(metrics.activeCenter - metrics.boardBodyCenter)).toBeLessThan(32);
      }

      await page.screenshot({ path: path.join(screenshotDir, viewport.file), fullPage: false });
    });
  }

  test('crowded lane scrolls vertically without horizontal overflow at narrow desktop', async ({ page }) => {
    await fs.mkdir(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: 1090, height: 1212 });
    await page.addInitScript((board) => {
      localStorage.clear();
      localStorage.setItem('pr_dashboard_board_cards', JSON.stringify(board));
    }, seededCrowdedBoard());
    await page.goto(`${baseURL}/#board`);

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const lane = document.querySelector('.board-lane-cards-container[data-lane="Considering"]');
      lane.scrollTop = 240;
      const activeGrid = document.querySelector('.board-active-grid');
      return {
        documentHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
        laneClientHeight: lane.clientHeight,
        laneScrollHeight: lane.scrollHeight,
        laneScrollTop: lane.scrollTop,
        laneHorizontalOverflow: lane.scrollWidth > lane.clientWidth + 1,
        activeGridColumns: getComputedStyle(activeGrid).gridTemplateColumns.split(' ').filter(Boolean).length
      };
    });

    expect(metrics.activeGridColumns).toBe(2);
    expect(metrics.documentHorizontalOverflow).toBe(false);
    expect(metrics.laneHorizontalOverflow).toBe(false);
    expect(metrics.laneScrollHeight).toBeGreaterThan(metrics.laneClientHeight);
    expect(metrics.laneScrollTop).toBeGreaterThan(0);

    await page.screenshot({ path: path.join(screenshotDir, 'board-a1-1090x1212-crowded.png'), fullPage: false });
  });

  test('forced compact board with many cards remains vertically reachable without horizontal overflow', async ({ page }) => {
    await fs.mkdir(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript((board) => {
      localStorage.clear();
      localStorage.setItem('pr_dashboard_board_cards', JSON.stringify(board));
    }, seededCompactCrowdedBoard());
    await page.goto(`${baseURL}/#board`);
    await page.getByRole('button', { name: 'Compact' }).click();
    await expect(page.locator('[data-board-section="completed"]')).toBeVisible();

    const initialMetrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const completed = document.querySelector('[data-board-section="completed"]');
      const passed = document.querySelector('.board-lane-cards-container[data-lane="Passed"]');
      const compactButtons = Array.from(document.querySelectorAll('.board-compact-card button'));
      return {
        documentHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
        documentCanScrollVertically: doc.scrollHeight > doc.clientHeight + 1,
        completedBottom: completed.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
        passedLaneScrolls: passed.scrollHeight > passed.clientHeight + 1,
        clippedCompactButtons: compactButtons
          .filter(button => button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1)
          .map(button => button.textContent.trim())
      };
    });

    expect(initialMetrics.documentHorizontalOverflow).toBe(false);
    expect(initialMetrics.documentCanScrollVertically).toBe(true);
    expect(initialMetrics.completedBottom).toBeGreaterThan(initialMetrics.viewportHeight);
    expect(initialMetrics.passedLaneScrolls).toBe(true);
    expect(initialMetrics.clippedCompactButtons).toEqual([]);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const scrolledMetrics = await page.evaluate(() => {
      const completed = document.querySelector('[data-board-section="completed"]');
      const passed = document.querySelector('.board-lane-cards-container[data-lane="Passed"]');
      passed.scrollTop = passed.scrollHeight;
      return {
        pageScrollTop: window.scrollY,
        completedTop: completed.getBoundingClientRect().top,
        completedVisible: completed.getBoundingClientRect().top < window.innerHeight
          && completed.getBoundingClientRect().bottom > 0,
        passedLaneScrollTop: passed.scrollTop
      };
    });

    expect(scrolledMetrics.pageScrollTop).toBeGreaterThan(0);
    expect(scrolledMetrics.completedTop).toBeLessThan(1080);
    expect(scrolledMetrics.completedVisible).toBe(true);
    expect(scrolledMetrics.passedLaneScrollTop).toBeGreaterThan(0);

    await page.screenshot({ path: path.join(screenshotDir, 'board-compact-crowded-1920x1080.png'), fullPage: false });
  });

  for (const viewport of inspectorViewports) {
    test(`inspector polish holds at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await fs.mkdir(screenshotDir, { recursive: true });
      await mockInspectorGitHub(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${baseURL}/#board`);

      const firstCard = page.locator('.board-card-item').first();
      await expect(firstCard).toBeVisible();
      await firstCard.click();
      await expect(page.locator('#inspector-overlay-drawer')).toBeVisible();
      await page.waitForTimeout(350);

      const beforeDrag = await page.evaluate(() => {
        const drawer = document.getElementById('inspector-overlay-drawer');
        return drawer.getBoundingClientRect().width;
      });

      const metrics = await page.evaluate(() => {
        const drawer = document.getElementById('inspector-overlay-drawer');
        const scroller = drawer.querySelector('.overflow-y-auto');
        const action = drawer.querySelector('.action-toolbar');
        const title = drawer.querySelector('[data-inspector-title-header]');
        const grid = drawer.querySelector('.advanced-context-grid');
        scroller.scrollTop = 800;

        const drawerRect = drawer.getBoundingClientRect();
        const actionRect = action.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        const cards = Array.from(drawer.querySelectorAll('.advanced-context-card'));
        return {
          documentHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          drawerHorizontalOverflow: drawer.scrollWidth > drawer.clientWidth + 1,
          scrollerScrollTop: scroller.scrollTop,
          titleHeightVar: drawer.style.getPropertyValue('--inspector-title-height'),
          actionVisibleAfterScroll: actionRect.top >= titleRect.bottom - 1 && actionRect.bottom <= drawerRect.bottom,
          actionSurface: getComputedStyle(action).backgroundColor,
          advancedColumns: getComputedStyle(grid).gridTemplateColumns
            .split(' ')
            .filter(value => Number.parseFloat(value) > 1)
            .length,
          clippedCards: cards.filter(card => card.scrollWidth > card.clientWidth + 1).map(card => card.textContent.trim().slice(0, 80))
        };
      });

      expect(metrics.documentHorizontalOverflow).toBe(false);
      expect(metrics.drawerHorizontalOverflow).toBe(false);
      expect(metrics.scrollerScrollTop).toBeGreaterThan(100);
      expect(metrics.titleHeightVar).toMatch(/px$/);
      expect(metrics.actionVisibleAfterScroll).toBe(true);
      expect(metrics.actionSurface).not.toBe('rgba(0, 0, 0, 0)');
      expect(metrics.advancedColumns).toBeGreaterThanOrEqual(1);
      expect(metrics.advancedColumns).toBeLessThanOrEqual(3);
      expect(metrics.clippedCards).toEqual([]);

      const handleBox = await page.locator('.inspector-resize-handle').boundingBox();
      expect(handleBox).not.toBeNull();
      await page.mouse.move(handleBox.x + 3, handleBox.y + 120);
      await page.mouse.down();
      await page.mouse.move(handleBox.x - 100, handleBox.y + 120);
      await page.mouse.up();

      const afterDrag = await page.evaluate(() => {
        const drawer = document.getElementById('inspector-overlay-drawer');
        return {
          width: drawer.getBoundingClientRect().width,
          stored: JSON.parse(localStorage.getItem('pr_dashboard_inspector_width_v1') || '{}')
        };
      });
      expect(afterDrag.width).toBeGreaterThan(beforeDrag);
      expect(Object.keys(afterDrag.stored).length).toBeGreaterThan(0);

      await page.reload();
      await expect(page.locator('.board-card-item').first()).toBeVisible();
      await page.locator('.board-card-item').first().click();
      await expect(page.locator('#inspector-overlay-drawer')).toBeVisible();
      await page.waitForTimeout(350);
      const reloadedWidth = await page.evaluate(() => document.getElementById('inspector-overlay-drawer').getBoundingClientRect().width);
      expect(Math.abs(reloadedWidth - afterDrag.width)).toBeLessThanOrEqual(2);

      await page.screenshot({ path: path.join(screenshotDir, viewport.file), fullPage: false });
    });
  }

  test('inspector refresh replays advanced context scan loading', async ({ page }) => {
    const { releaseIssueRefresh } = await mockInspectorGitHub(page, { holdIssueRefresh: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseURL}/#board`);

    await page.locator('.board-card-item').first().click();
    await expect(page.locator('#inspector-overlay-drawer')).toBeVisible();
    await expect(page.locator('.advanced-context-card-loaded').filter({ hasText: 'Timeline inspected' })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.advanced-context-card-loaded').filter({ hasText: 'Setup files inspected' })).toBeVisible();
    await expect(page.locator('.advanced-context-card-loaded').filter({ hasText: 'Repo history inspected' })).toBeVisible();

    await page.locator('#inspector-refresh-card-btn').click();
    await expect(page.locator('.advanced-context-card-loading').filter({ hasText: 'Fetching timeline' })).toBeVisible();
    await expect(page.locator('.advanced-context-card-loading').filter({ hasText: 'Scanning setup files' })).toBeVisible();
    await expect(page.locator('.advanced-context-card-loading').filter({ hasText: 'Reading repo history' })).toBeVisible();
    await page.waitForTimeout(1300);
    await expect(page.locator('.advanced-context-card-loading').filter({ hasText: 'Fetching timeline' })).toBeVisible();
    await expect(page.locator('.advanced-context-card-loaded').filter({ hasText: 'Timeline inspected' })).toBeHidden();
    releaseIssueRefresh();
    await expect(page.locator('.advanced-context-card-loaded').filter({ hasText: 'Timeline inspected' })).toBeVisible({ timeout: 3000 });
  });

  test('inspector resize handle is hidden on mobile', async ({ page }) => {
    await mockInspectorGitHub(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/#board`);
    await page.locator('.board-card-item').first().click();
    await expect(page.locator('#inspector-overlay-drawer')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const drawer = document.getElementById('inspector-overlay-drawer');
      const handle = drawer.querySelector('.inspector-resize-handle');
      return {
        handleDisplay: getComputedStyle(handle).display,
        drawerInlineWidth: drawer.style.width,
        drawerHorizontalOverflow: drawer.scrollWidth > drawer.clientWidth + 1
      };
    });

    expect(metrics.handleDisplay).toBe('none');
    expect(metrics.drawerInlineWidth).toBe('');
    expect(metrics.drawerHorizontalOverflow).toBe(false);
  });
});
