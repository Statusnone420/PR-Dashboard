import test from 'node:test';
import assert from 'node:assert/strict';

test('platform setup scan candidates include default all-platform searches and cap at thirty', async () => {
  const { DEFAULT_PLATFORM_SETUP_SCAN_LIMIT, getPlatformSetupScanCandidates } = await import('../src/platformSetupScan.js');

  const issues = Array.from({ length: 40 }, (_, index) => ({
    id: index + 1,
    title: `Issue ${index + 1}`,
    html_url: `https://github.com/demo/platform/issues/${index + 1}`,
    repository: { full_name: 'demo/platform' },
    number: index + 1
  }));
  const cachedKeys = new Set(['demo/platform#2']);

  assert.equal(DEFAULT_PLATFORM_SETUP_SCAN_LIMIT, 30);
  assert.deepEqual(getPlatformSetupScanCandidates(issues, {
    targetPlatforms: ['ios', 'android', 'macos', 'linux', 'windows', 'web']
  }, {
    hasCachedSetup: issue => cachedKeys.has(`demo/platform#${issue.number}`)
  }).map(issue => issue.number), [
    1, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31
  ]);

  const candidates = getPlatformSetupScanCandidates(issues, {
    targetPlatforms: ['windows']
  }, {
    limit: 4,
    hasCachedSetup: issue => cachedKeys.has(`demo/platform#${issue.number}`)
  });

  assert.deepEqual(candidates.map(issue => issue.number), [1, 3, 4, 5]);
});

test('platform setup scan candidates honor session summaries when token-used cache is not persisted', async () => {
  const { getPlatformSetupScanCandidates } = await import('../src/platformSetupScan.js');

  const issues = [
    {
      id: 1,
      title: 'Needs setup scan',
      html_url: 'https://github.com/demo/platform/issues/1',
      repository: { full_name: 'demo/platform' },
      number: 1
    },
    {
      id: 2,
      title: 'Already scanned this session',
      html_url: 'https://github.com/demo/platform/issues/2',
      repository: { full_name: 'demo/platform' },
      number: 2
    }
  ];
  const sessionScannedKeys = new Set(['demo/platform#2']);

  const candidates = getPlatformSetupScanCandidates(issues, {
    targetPlatforms: ['windows']
  }, {
    hasCachedSetup: issue => sessionScannedKeys.has(`demo/platform#${issue.number}`)
  });

  assert.deepEqual(candidates.map(issue => issue.number), [1]);
});

test('platform setup session summaries expire before suppressing future scans', async () => {
  const {
    getPlatformSetupSessionSummary,
    setPlatformSetupSessionSummary
  } = await import('../src/platformSetupScan.js');
  const summaries = new Map();
  const summary = {
    inspected: true,
    platformSupport: { linux: true },
    reasons: ['Linux setup supported']
  };

  setPlatformSetupSessionSummary(summaries, 'demo/platform#1', summary, {
    now: Date.parse('2026-05-25T00:00:00.000Z'),
    ttlMs: 1000
  });

  assert.deepEqual(getPlatformSetupSessionSummary(summaries, 'demo/platform#1', {
    now: Date.parse('2026-05-25T00:00:00.999Z')
  }), summary);
  assert.equal(getPlatformSetupSessionSummary(summaries, 'demo/platform#1', {
    now: Date.parse('2026-05-25T00:00:01.001Z')
  }), null);
  assert.equal(summaries.has('demo/platform#1'), false);
});

test('platform setup scan budget caps cumulative scans for one search', async () => {
  const {
    createPlatformSetupScanBudget,
    reservePlatformSetupScanBudget
  } = await import('../src/platformSetupScan.js');
  const budget = createPlatformSetupScanBudget({ limit: 3 });
  const issues = Array.from({ length: 5 }, (_, index) => ({
    number: index + 1,
    repository: { full_name: 'demo/platform' }
  }));
  const getKey = issue => `demo/platform#${issue.number}`;

  const firstRender = reservePlatformSetupScanBudget(budget, 'search-a', issues.slice(0, 2), { getKey });
  const secondRender = reservePlatformSetupScanBudget(budget, 'search-a', issues.slice(2), { getKey });
  const thirdRender = reservePlatformSetupScanBudget(budget, 'search-a', issues.slice(3), { getKey });
  const nextSearch = reservePlatformSetupScanBudget(budget, 'search-b', issues.slice(3), { getKey });

  assert.deepEqual(firstRender.map(issue => issue.number), [1, 2]);
  assert.deepEqual(secondRender.map(issue => issue.number), [3]);
  assert.deepEqual(thirdRender.map(issue => issue.number), []);
  assert.deepEqual(nextSearch.map(issue => issue.number), [4, 5]);
});

test('platform setup scan failures are scoped to the active search run', async () => {
  const { recordPlatformSetupScanFailure } = await import('../src/platformSetupScan.js');
  const failures = new Set();

  assert.equal(recordPlatformSetupScanFailure(failures, 'demo/platform#1', 1, 2), false);
  assert.equal(failures.has('demo/platform#1'), false);

  assert.equal(recordPlatformSetupScanFailure(failures, 'demo/platform#1', 2, 2), true);
  assert.equal(failures.has('demo/platform#1'), true);
});

test('platform setup scan queues stop before dequeuing stale search candidates', async () => {
  const setupScan = await import('../src/platformSetupScan.js');

  assert.equal(typeof setupScan.shouldContinuePlatformSetupScanQueue, 'function');
  assert.equal(setupScan.shouldContinuePlatformSetupScanQueue({
    scanRunId: 1,
    activeRunId: 2,
    stopForRateLimit: false,
    nextIndex: 0,
    totalCandidates: 3
  }), false);
  assert.equal(setupScan.shouldContinuePlatformSetupScanQueue({
    scanRunId: 2,
    activeRunId: 2,
    stopForRateLimit: false,
    nextIndex: 0,
    totalCandidates: 3
  }), true);
  assert.equal(setupScan.shouldContinuePlatformSetupScanQueue({
    scanRunId: 2,
    activeRunId: 2,
    stopForRateLimit: true,
    nextIndex: 0,
    totalCandidates: 3
  }), false);
});

test('platform setup scan rerenders are limited to active search runs', async () => {
  const setupScan = await import('../src/platformSetupScan.js');

  assert.equal(typeof setupScan.shouldSchedulePlatformSetupScanRerender, 'function');
  assert.equal(setupScan.shouldSchedulePlatformSetupScanRerender({
    scanRunId: 1,
    activeRunId: 2,
    currentScreen: 'find-issues',
    stillInCurrentResults: true
  }), false);
  assert.equal(setupScan.shouldSchedulePlatformSetupScanRerender({
    scanRunId: 2,
    activeRunId: 2,
    currentScreen: 'find-issues',
    stillInCurrentResults: true
  }), true);
  assert.equal(setupScan.shouldSchedulePlatformSetupScanRerender({
    scanRunId: 2,
    activeRunId: 2,
    currentScreen: 'board',
    stillInCurrentResults: true
  }), false);
  assert.equal(setupScan.shouldSchedulePlatformSetupScanRerender({
    scanRunId: 2,
    activeRunId: 2,
    currentScreen: 'find-issues',
    stillInCurrentResults: false
  }), false);
});
