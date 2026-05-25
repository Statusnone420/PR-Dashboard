const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const screenshotDir = 'D:/PR Dashboard/qa_screenshots/readme';
const baseURL = process.env.PR_DASHBOARD_BASE_URL || 'http://127.0.0.1:4174';
const now = '2026-05-23T12:00:00.000Z';

const teammatesRepo = {
  id: 19369035,
  name: 'teammates',
  full_name: 'TEAMMATES/teammates',
  html_url: 'https://github.com/TEAMMATES/teammates',
  description: 'TEAMMATES is a feedback management tool for education',
  stargazers_count: 1823,
  forks_count: 3588,
  open_issues_count: 96,
  pushed_at: '2026-05-23T01:32:20Z',
  archived: false,
  disabled: false,
  default_branch: 'master',
  language: 'Java',
  topics: ['angular', 'educators', 'feedback-systems', 'java', 'typescript']
};

const labels = {
  goodFirstIssue: {
    id: 96640843,
    name: 'good first issue',
    color: '7057ff',
    description: 'Easy; restricted for first-time contributors'
  },
  helpWanted: {
    id: 96881841,
    name: 'help wanted',
    color: '008672',
    description: 'Moderate difficulty; small localized change'
  },
  docs: {
    id: 158248764,
    name: 'a-Docs',
    color: 'E6CCFF',
    description: 'User or developer docs'
  }
};

function user(login, id) {
  return {
    login,
    id,
    avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
    html_url: `https://github.com/${login}`,
    type: 'User',
    site_admin: false
  };
}

function issue(number, title, options = {}) {
  return {
    id: 4499000000 + number,
    number,
    title,
    body: options.body || 'Public TEAMMATES issue snapshot used for README screenshots.',
    state: options.state || 'open',
    state_reason: options.stateReason || null,
    created_at: options.createdAt || '2026-05-22T12:00:00Z',
    updated_at: options.updatedAt || '2026-05-23T02:00:16Z',
    closed_at: options.closedAt || null,
    labels: options.labels || [],
    assignee: options.assignee || null,
    assignees: options.assignees || [],
    comments: options.comments ?? 0,
    html_url: options.htmlUrl || `https://github.com/TEAMMATES/teammates/issues/${number}`,
    repository_url: 'https://api.github.com/repos/TEAMMATES/teammates',
    repository: teammatesRepo,
    user: options.user || user('samuelfangjw', 60355570),
    pull_request: options.pullRequest || undefined
  };
}

const issue13997 = issue(
  13997,
  'Replace JSON.parse(JSON.stringify(...)) with structuredClone',
  {
    state: 'closed',
    stateReason: 'completed',
    createdAt: '2026-05-22T03:03:05Z',
    updatedAt: '2026-05-22T05:26:26Z',
    closedAt: '2026-05-22T05:26:26Z',
    labels: [labels.goodFirstIssue],
    comments: 4,
    body: 'We currently use JSON.parse(JSON.stringify(...)) in several places for deep cloning objects. This should be replaced with structuredClone(...) where appropriate.'
  }
);

const pull13998 = issue(
  13998,
  '[#13997] Replace JSON deep clones with structuredClone',
  {
    state: 'closed',
    createdAt: '2026-05-22T04:25:34Z',
    updatedAt: '2026-05-22T05:26:25Z',
    closedAt: '2026-05-22T05:26:25Z',
    comments: 0,
    htmlUrl: 'https://github.com/TEAMMATES/teammates/pull/13998',
    user: user('Statusnone420', 244280175),
    body: 'Fixes #13997. Replaced JSON deep-clone calls under src/web with structuredClone, while leaving actual JSON parsing unchanged. Verified with format, lint, tests, build, and Gradle lint.',
    pullRequest: {
      url: 'https://api.github.com/repos/TEAMMATES/teammates/pulls/13998',
      html_url: 'https://github.com/TEAMMATES/teammates/pull/13998',
      merged_at: '2026-05-22T05:26:24Z'
    }
  }
);

const issue14005 = issue(
  14005,
  'Rename id field in AccountRequestData to accountRequestId',
  {
    labels: [labels.helpWanted],
    createdAt: '2026-05-23T02:00:16Z',
    updatedAt: '2026-05-23T02:00:16Z',
    body: 'In AccountRequestData.java, rename the id field to accountRequestId for consistency with the rest of the API output DTOs. Run ./gradlew generateTypes and update the frontend types accordingly.'
  }
);

const issue13698 = issue(
  13698,
  'Update PR Checker to fail workflow and persist comment updates',
  {
    labels: [labels.helpWanted],
    comments: 3,
    createdAt: '2026-04-01T14:24:03Z',
    updatedAt: '2026-05-21T07:00:44Z',
    body: 'Improve the GitHub Actions PR checker so template violations fail the action and bot comments are updated when violations appear or are resolved.'
  }
);

const issue13944 = issue(
  13944,
  'Remove shown property from Notification entity',
  {
    labels: [labels.helpWanted],
    comments: 6,
    createdAt: '2026-05-15T19:52:16Z',
    updatedAt: '2026-05-19T15:17:09Z',
    body: 'Replace the shown property with a deterministic visibility rule based on notification display windows, including schema migration and rollback notes.'
  }
);

const issue14003 = issue(
  14003,
  'Replace ngx-page-scroll with Angular ViewportScroller',
  {
    assignee: user('samuelfangjw', 60355570),
    assignees: [user('samuelfangjw', 60355570)],
    createdAt: '2026-05-22T19:46:14Z',
    updatedAt: '2026-05-22T19:46:14Z',
    body: 'Angular provides native scrolling support through ViewportScroller. Remove ngx-page-scroll to reduce third-party dependency surface.'
  }
);

const searchIssues = [issue14005, issue13698, issue13944, issue14003];

function checklist(doneCount) {
  const tasks = [
    'Read README.',
    'Read CONTRIBUTING.md.',
    'Check install/test command.',
    'Identify likely files.',
    'Open issue discussion.',
    'Decide attempt/pass.'
  ];
  return tasks.map((text, index) => ({ text, completed: index < doneCount }));
}

function boardCard(source, column, overrides = {}) {
  return {
    ...source,
    source: 'github',
    saved_at: overrides.saved_at || '2026-05-22T13:00:00.000Z',
    last_moved_at: overrides.last_moved_at || '2026-05-22T13:00:00.000Z',
    column_entered_at: overrides.column_entered_at || '2026-05-22T13:00:00.000Z',
    last_refreshed_at: overrides.last_refreshed_at || '2026-05-22T13:00:00.000Z',
    state: overrides.state || source.state,
    state_reason: overrides.state_reason ?? source.state_reason,
    checklist: overrides.checklist || checklist(0),
    progress: overrides.progress || 0,
    commits: overrides.commits || 0,
    column,
    github_activity: overrides.github_activity
  };
}

function boardFixture() {
  return {
    Considering: [boardCard(issue14005, 'Considering')],
    'Read Docs': [boardCard(issue13698, 'Read Docs', {
      checklist: checklist(2),
      progress: 33,
      column_entered_at: '2026-05-20T11:00:00.000Z',
      last_refreshed_at: '2026-05-20T11:00:00.000Z'
    })],
    'Asked Maintainer': [boardCard(issue13944, 'Asked Maintainer', {
      checklist: checklist(4),
      progress: 67,
      column_entered_at: '2026-05-18T10:00:00.000Z',
      last_refreshed_at: '2026-05-23T09:30:00.000Z',
      github_activity: {
        has_new_activity: true,
        last_checked_at: '2026-05-23T09:30:00.000Z',
        summary: '2 new comments since last refresh.'
      }
    })],
    Working: [boardCard(issue14003, 'Working', {
      checklist: checklist(3),
      progress: 50,
      column_entered_at: '2026-05-22T20:00:00.000Z',
      last_refreshed_at: '2026-05-22T20:00:00.000Z'
    })],
    'PR Open': [],
    Merged: [boardCard(pull13998, 'Merged', {
      checklist: checklist(6),
      progress: 100,
      commits: 2,
      saved_at: '2026-05-22T04:25:34.000Z',
      last_moved_at: '2026-05-22T05:26:24.000Z',
      column_entered_at: '2026-05-22T05:26:24.000Z',
      last_refreshed_at: '2026-05-22T05:26:25.000Z',
      state: 'merged',
      state_reason: 'completed'
    })],
    Passed: []
  };
}

function proofLogFixture() {
  return {
    version: 1,
    entries: {
      'teammates/teammates#13998': {
        key: 'teammates/teammates#13998',
        type: 'pull',
        status: 'marked_complete',
        source: 'board_merged',
        issue_url: '',
        pr_url: 'https://github.com/TEAMMATES/teammates/pull/13998',
        proof_url: 'https://github.com/TEAMMATES/teammates/pull/13998',
        completed_at: '2026-05-22T05:26:24.000Z',
        created_at: '2026-05-22T05:26:24.000Z',
        updated_at: '2026-05-22T05:26:24.000Z',
        last_seen_at: '2026-05-22T05:26:24.000Z',
        note: 'Merged TEAMMATES contribution discovered through PR Dashboard.',
        snapshot: {
          title: '[#13997] Replace JSON deep clones with structuredClone',
          repo: 'TEAMMATES/teammates',
          display_key: 'TEAMMATES/teammates#13998',
          number: 13998,
          checklist: checklist(6),
          progress: 100,
          board_column: 'Merged'
        }
      }
    }
  };
}

function profileFixture() {
  return {
    version: 1,
    github_id: '244280175',
    login: 'Statusnone420',
    name: 'Anthony',
    github_url: 'https://github.com/Statusnone420',
    avatar_url: 'https://avatars.githubusercontent.com/u/244280175?v=4',
    saved_at: '2026-05-22T05:30:00.000Z'
  };
}

async function seedLocalStorage(page) {
  await page.addInitScript(({ board, proofLog, profile }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('pr_dashboard_board_cards', JSON.stringify(board));
    localStorage.setItem('pr_dashboard_proof_log_v1', JSON.stringify(proofLog));
    localStorage.setItem('pr_dashboard_profile_v1', JSON.stringify(profile));
  }, {
    board: boardFixture(),
    proofLog: proofLogFixture(),
    profile: profileFixture()
  });
}

async function routeGitHub(page) {
  await page.route('https://api.github.com/search/issues**', async route => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-resource': 'search',
        'x-ratelimit-limit': '30',
        'x-ratelimit-remaining': '27',
        'x-ratelimit-used': '3',
        'x-ratelimit-reset': '1770000300'
      },
      body: JSON.stringify({
        total_count: searchIssues.length,
        incomplete_results: false,
        items: searchIssues
      })
    });
  });

  await page.route('https://api.github.com/repos/TEAMMATES/teammates', async route => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-resource': 'core',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4990',
        'x-ratelimit-used': '10',
        'x-ratelimit-reset': '1770000000'
      },
      body: JSON.stringify(teammatesRepo)
    });
  });

  await page.route('https://api.github.com/rate_limit', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        resources: {
          core: { limit: 5000, remaining: 4988, used: 12, reset: 1770000000 },
          search: { limit: 30, remaining: 27, used: 3, reset: 1770000300 }
        }
      })
    });
  });
}

async function expectHealthyPage(page, expectedText) {
  const content = page.locator('#app-content');
  await expect(content).toContainText(expectedText);
  await page.waitForTimeout(100);
  const metrics = await page.evaluate(() => ({
    documentHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    bodyText: document.body.innerText
  }));
  expect(metrics.documentHorizontalOverflow).toBe(false);
  for (const banned of ['Seeded by', 'lorem', 'Obsidian', 'fake issue']) {
    expect(metrics.bodyText).not.toContain(banned);
  }
}

test.describe('README gallery screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await fs.mkdir(screenshotDir, { recursive: true });
    await seedLocalStorage(page);
    await routeGitHub(page);
    await page.setViewportSize({ width: 1920, height: 1080 });

    const runtimeErrors = [];
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) {
        runtimeErrors.push(`console ${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', error => {
      runtimeErrors.push(`pageerror: ${error.message}`);
    });
    page.runtimeErrors = runtimeErrors;
  });

  test('captures Find Contributions hero with real TEAMMATES candidates', async ({ page }) => {
    await page.goto(`${baseURL}/#find-issues`);
    await page.locator('#search-keyword-input').fill('repo:TEAMMATES/teammates');
    await page.locator('#search-trigger-btn').click();
    await expect(page.locator('.issue-card')).toHaveCount(4);
    await expect(page.locator('body')).toContainText('Rename id field in AccountRequestData to accountRequestId');
    await expect(page.locator('body')).toContainText('Update PR Checker to fail workflow and persist comment updates');
    await expect(page.locator('body')).toContainText('TEAMMATES/teammates');
    await expectHealthyPage(page, 'Find Contributions');
    expect(page.runtimeErrors).toEqual([]);
    await page.screenshot({ path: path.join(screenshotDir, 'hero-find-contributions-1920x1080.png'), fullPage: false });
  });

  test('captures Board workflow with active work and merged proof source', async ({ page }) => {
    await page.goto(`${baseURL}/#board`);
    await expect(page.locator('[data-board-section="active"]')).toBeVisible();
    await expect(page.locator('[data-board-section="completed"]')).toBeVisible();
    await expect(page.locator('body')).toContainText('Replace ngx-page-scroll with Angular ViewportScroller');
    await expect(page.locator('body')).toContainText('[#13997] Replace JSON deep clones with structuredClone');
    await expect(page.locator('body')).toContainText('2 new comments since last refresh.');
    await expectHealthyPage(page, 'Active workflow');
    expect(page.runtimeErrors).toEqual([]);
    await page.screenshot({ path: path.join(screenshotDir, 'board-workflow-1920x1080.png'), fullPage: false });
  });

  test('captures Activity Proof Log and Review reminders', async ({ page }) => {
    await page.goto(`${baseURL}/#activity`);
    await expect(page.locator('body')).toContainText('Proof Log');
    await expect(page.locator('body')).toContainText('[#13997] Replace JSON deep clones with structuredClone');
    await expect(page.locator('body')).toContainText('Review reminders');
    await expect(page.locator('body')).toContainText('Personal scoring signals');
    await expectHealthyPage(page, 'Activity');
    expect(page.runtimeErrors).toEqual([]);
    await page.screenshot({ path: path.join(screenshotDir, 'activity-proof-log-1920x1080.png'), fullPage: false });
  });

  test('captures API limits popover with core and search buckets', async ({ page }) => {
    await page.goto(`${baseURL}/#dashboard`);
    await page.locator('#api-limits-trigger').click();
    await page.locator('#api-limits-check-btn').click();
    await expect(page.locator('#api-limits-popover')).toBeVisible();
    await expect(page.locator('#api-limits-core-row')).toContainText('4,988 / 5,000');
    await expect(page.locator('#api-limits-search-row')).toContainText('27 / 30');
    await expectHealthyPage(page, 'Saved candidates');
    expect(page.runtimeErrors).toEqual([]);
    await page.screenshot({ path: path.join(screenshotDir, 'api-limits-popover-1920x1080.png'), fullPage: false });
  });
});
