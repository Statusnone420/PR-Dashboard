const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const constantsPromise = import('../src/boardConstants.js');

const baseURL = process.env.PR_DASHBOARD_BASE_URL || 'http://127.0.0.1:3000';
const screenshotDir = 'D:/PR Dashboard/qa_screenshots/board-layout-a1';

const viewports = [
  { width: 390, height: 844, file: 'board-a1-390x844.png', mobile: true },
  { width: 375, height: 667, file: 'board-a1-375x667.png', mobile: true },
  { width: 1090, height: 1212, file: 'board-a1-1090x1212.png', expectedColumns: 2 },
  { width: 1366, height: 768, file: 'board-a1-1366x768.png', expectedColumns: 3 },
  { width: 1920, height: 1080, file: 'board-a1-1920x1080.png', mobile: false },
  { width: 3440, height: 1440, file: 'board-a1-3440x1440.png', mobile: false }
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

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((board) => {
      localStorage.clear();
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
});
