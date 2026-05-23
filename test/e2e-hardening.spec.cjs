const { test, expect } = require('@playwright/test');
const crypto = require('node:crypto');

const baseURL = 'http://127.0.0.1:3000';
const screenshotDir = 'D:/PR Dashboard/qa_screenshots';

function safeTitle(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

test('no-PAT search, board persistence, inspectors, links, and settings token hygiene', async ({ page, context }) => {
  const userRequests = [];
  const searchRequests = [];
  const consoleMessages = [];
  const sentinel = crypto.randomUUID();

  page.on('console', message => {
    consoleMessages.push(message.text());
  });

  await page.route('https://api.github.com/user', async route => {
    const req = route.request();
    userRequests.push({
      url: req.url(),
      method: req.method(),
      authorizationPresent: Boolean(req.headers().authorization),
      authorizationMatches: req.headers().authorization === `Bearer ${sentinel}`
    });
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-limit': '5000'
      },
      body: JSON.stringify({ login: 'hardening-check' })
    });
  });

  await page.route(/https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/issues\/\d+$/, async route => {
    const reqUrl = route.request().url();
    const match = reqUrl.match(/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    const owner = match?.[1] || 'facebook';
    const repo = match?.[2] || 'react';
    const number = Number(match?.[3] || 1);
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-remaining': '4998',
        'x-ratelimit-limit': '5000'
      },
      body: JSON.stringify({
        id: number,
        number,
        title: 'Closed metadata smoke issue',
        body: 'Closed metadata fetched from GitHub API route.',
        state: 'closed',
        state_reason: 'completed',
        updated_at: '2026-05-20T12:00:00Z',
        closed_at: '2026-05-20T12:00:00Z',
        labels: [{ name: 'help wanted' }],
        assignee: null,
        assignees: [],
        comments: 2,
        html_url: `https://github.com/${owner}/${repo}/issues/${number}`,
        repository: {
          name: repo,
          full_name: `${owner}/${repo}`,
          stargazers_count: 1000
        }
      })
    });
  });

  page.on('request', request => {
    if (request.url().startsWith('https://api.github.com/search/issues')) {
      searchRequests.push({
        url: request.url(),
        method: request.method(),
        authorizationPresent: Boolean(request.headers().authorization)
      });
    }
  });

  await page.goto(`${baseURL}/#find-issues`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await expect(page.locator('#search-keyword-input')).toHaveValue('');
  await expect(page.locator('#api-limits-trigger')).toBeVisible();
  await expect(page.locator('#api-limits-summary')).toHaveText('API limits');

  await page.goto(`${baseURL}/#board`);
  await expect(page.locator('.board-card-item')).toHaveCount(0);
  await page.goto(`${baseURL}/#find-issues`);

  await page.locator('button.label-filter-btn[data-label="help wanted"]').click();
  await page.locator('input.stars-filter-radio[data-value="Any"]').check();
  await page.waitForTimeout(750);
  expect(searchRequests).toHaveLength(0);

  await expect(page.locator('#github-query-preview')).toContainText('state:open');
  await page.locator('#search-keyword-input').fill('repo:facebook/react');
  await expect(page.locator('#github-query-preview')).toContainText('repo:facebook/react');

  for (const preset of ['quick-wins', 'docs-only', 'low-noise']) {
    const before = searchRequests.length;
    const presetResponsePromise = page.waitForResponse(response => response.url().startsWith('https://api.github.com/search/issues') && response.request().method() === 'GET', { timeout: 45000 });
    await page.locator(`.preset-search-btn[data-preset="${preset}"]`).click();
    const presetResponse = await presetResponsePromise;
    expect(searchRequests.length).toBe(before + 1);
    expect(presetResponse.request().method()).toBe('GET');
  }

  const beforeFilterReset = searchRequests.length;
  await page.locator('button.label-filter-btn[data-label="help wanted"]').click();
  await page.locator('#comments-filter-select').selectOption({ label: 'Any' });
  await page.locator('#updated-filter-select').selectOption({ label: 'Any' });
  await page.waitForTimeout(750);
  expect(searchRequests).toHaveLength(beforeFilterReset);

  await page.locator('#search-keyword-input').fill('repo:facebook/react');
  const beforeExplicitSearch = searchRequests.length;
  const searchResponsePromise = page.waitForResponse(response => response.url().startsWith('https://api.github.com/search/issues') && response.request().method() === 'GET', { timeout: 45000 });
  await page.locator('#search-trigger-btn').click();
  const searchResponse = await searchResponsePromise;
  expect(searchRequests).toHaveLength(beforeExplicitSearch + 1);
  expect(searchRequests.at(-1).authorizationPresent).toBe(false);
  expect(searchRequests.at(-1).url).not.toContain('Authorization');
  expect(searchResponse.ok()).toBe(true);

  const searchData = await searchResponse.json();
  expect(Array.isArray(searchData.items)).toBe(true);
  expect(searchData.items.length).toBeGreaterThan(0);
  await expect(page.locator('.issue-card').first()).toBeVisible({ timeout: 45000 });
  await expect(page.locator('#api-limits-trigger')).toBeVisible();
  await expect(page.locator('#api-limits-summary')).toContainText(/Search|REST/);

  const firstCard = page.locator('.issue-card').first();
  const firstTitle = safeTitle(await firstCard.locator('.pr-title-click').textContent());
  const firstHref = await firstCard.locator('a[target="_blank"]').getAttribute('href');
  expect(firstHref).toMatch(/^https:\/\/github\.com\//);
  expect(searchData.items.some(item => item.html_url === firstHref)).toBe(true);
  await expect(firstCard.locator('a[target="_blank"]')).toHaveAttribute('rel', 'noopener noreferrer');

  await firstCard.locator('.inspect-issue-btn').click();
  await expect(page.locator('#inspector-overlay-drawer')).toBeVisible();
  const findInspectorLink = page.locator('#inspector-overlay-drawer a', { hasText: 'Open on GitHub' });
  await expect(findInspectorLink).toHaveAttribute('rel', 'noopener noreferrer');
  const inspectorHref = await findInspectorLink.getAttribute('href');
  expect(inspectorHref).toBe(firstHref);
  const [githubTab] = await Promise.all([
    context.waitForEvent('page'),
    findInspectorLink.click()
  ]);
  await githubTab.waitForLoadState('domcontentloaded', { timeout: 45000 }).catch(() => {});
  expect(githubTab.url()).toBe(firstHref);
  await githubTab.close();
  await page.locator('#inspector-close-btn').click();

  await firstCard.locator('.save-issue-btn').click();
  await page.goto(`${baseURL}/#board`);
  const boardCardByTitle = page.locator('.board-card-item').filter({ hasText: firstTitle }).first();
  await expect(boardCardByTitle).toBeVisible();
  await page.reload();
  await expect(page.locator('.board-card-item').filter({ hasText: firstTitle }).first()).toBeVisible();

  await page.locator('.board-card-item').filter({ hasText: firstTitle }).first().click();
  await expect(page.locator('#inspector-overlay-drawer')).toBeVisible();
  const boardInspectorHref = await page.locator('#inspector-overlay-drawer a', { hasText: 'Open on GitHub' }).getAttribute('href');
  expect(boardInspectorHref).toBe(firstHref);
  await page.locator('#inspector-close-btn').click();

  await page.locator('.board-card-item').filter({ hasText: firstTitle }).first().locator('.move-right-btn').click();
  await page.reload();
  await expect(page.locator('.board-lane-cards-container[data-lane="Read Docs"] .board-card-item').filter({ hasText: firstTitle }).first()).toBeVisible();

  await page.locator('#board-refresh-stale-btn').click();
  await expect(page.locator('.board-card-item').filter({ hasText: 'Closed metadata smoke issue' }).first()).toBeVisible();
  await expect(page.locator('.board-card-item').filter({ hasText: 'Closed metadata smoke issue' }).first()).toContainText('Closed');
  await page.locator('.board-card-item').filter({ hasText: 'Closed metadata smoke issue' }).first().locator('.move-passed-btn').click();
  await expect(page.locator('.board-lane-cards-container[data-lane="Passed"] .board-card-item').filter({ hasText: 'Closed metadata smoke issue' }).first()).toBeVisible();

  await page.goto(`${baseURL}/#dashboard`);
  await page.locator('.dashboard-issue-card').first().click();
  await expect(page.locator('#inspector-overlay-drawer')).toBeVisible();
  const dashboardInspectorHref = await page.locator('#inspector-overlay-drawer a', { hasText: 'Open on GitHub' }).getAttribute('href');
  expect(dashboardInspectorHref).toMatch(/^https:\/\/github\.com\//);
  await page.locator('#inspector-close-btn').click();

  await page.goto(`${baseURL}/#settings`);
  await expect(page.locator('#settings-pat-input')).toHaveValue('');
  const userRequestsBeforeEmptyTest = userRequests.length;
  await page.locator('#test-connection-btn').click();
  await expect(page.locator('#settings-connection-status')).toContainText('Please provide a token');
  expect(userRequests).toHaveLength(userRequestsBeforeEmptyTest);

  await page.locator('#settings-pat-input').fill(sentinel);
  await page.locator('#test-connection-btn').click();
  await expect(page.locator('#settings-connection-status')).toContainText('Connection active');
  expect(userRequests).toHaveLength(userRequestsBeforeEmptyTest + 1);
  expect(userRequests.at(-1)).toEqual({
    url: 'https://api.github.com/user',
    method: 'GET',
    authorizationPresent: true,
    authorizationMatches: true
  });

  await page.locator('#save-settings-btn').click();
  const savedState = await page.evaluate(() => ({
    remember: localStorage.getItem('pr_dashboard_remember_token'),
    token: localStorage.getItem('pr_dashboard_token'),
    board: localStorage.getItem('pr_dashboard_board_cards')
  }));
  expect(savedState.remember).toBe('false');
  expect(savedState.token).toBe(null);
  expect(savedState.board).toContain('Closed metadata smoke issue');

  await page.locator('#clear-token-settings-btn').click();
  await page.locator('#settings-pat-input').fill('');
  const afterClearState = await page.evaluate(() => ({
    remember: localStorage.getItem('pr_dashboard_remember_token'),
    token: localStorage.getItem('pr_dashboard_token'),
    board: localStorage.getItem('pr_dashboard_board_cards'),
    inputValue: document.querySelector('#settings-pat-input')?.value || ''
  }));
  expect(afterClearState.remember).toBe(null);
  expect(afterClearState.token).toBe(null);
  expect(afterClearState.board).not.toBe(null);
  expect(afterClearState.inputValue).toBe('');

  await page.locator('#clear-board-settings-btn').click();
  const afterBoardClearState = await page.evaluate(() => ({
    token: localStorage.getItem('pr_dashboard_token'),
    board: localStorage.getItem('pr_dashboard_board_cards')
  }));
  expect(afterBoardClearState.token).toBe(null);
  expect(afterBoardClearState.board).toBe(null);
  expect(consoleMessages.join('\n')).not.toContain(sentinel);

  const routes = ['dashboard', 'find-issues', 'board', 'settings'];
  const sizes = [
    { width: 1920, height: 1080 },
    { width: 3440, height: 1440 }
  ];

  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const route of routes) {
      await page.goto(`${baseURL}/#${route}`);
      await page.waitForLoadState('domcontentloaded');
      if (route === 'settings') {
        await expect(page.locator('#settings-pat-input')).toHaveValue('');
      }
      await page.screenshot({ path: `${screenshotDir}/${route}-${size.width}x${size.height}.png`, fullPage: false });
    }
  }
});
