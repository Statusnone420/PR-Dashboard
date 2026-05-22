const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const constantsPromise = import('../src/boardConstants.js');

const baseURL = process.env.PR_DASHBOARD_BASE_URL || 'http://127.0.0.1:3000';
const screenshotDir = 'D:/PR Dashboard/qa_screenshots/board-layout-a1';

const viewports = [
  { width: 390, height: 844, file: 'board-a1-390x844.png', mobile: true },
  { width: 375, height: 667, file: 'board-a1-375x667.png', mobile: true },
  { width: 1366, height: 768, file: 'board-a1-1366x768.png', mobile: false },
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
    Considering: Array.from({ length: 5 }, (_, index) => card(1000 + index, 'Considering', index + 1)),
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

test.describe('A1 board layout', () => {
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
          activeGridColumns: getComputedStyle(activeGrid).gridTemplateColumns.split(' ').filter(Boolean).length,
          viewportWidth: window.innerWidth
        };
      });

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
      expect(metrics.completedTop).toBeGreaterThan(metrics.activeTop);

      if (viewport.mobile) {
        expect(metrics.secondLaneTop).toBeGreaterThan(metrics.firstLaneTop);
        expect(metrics.activeGridColumns).toBe(1);
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
});
