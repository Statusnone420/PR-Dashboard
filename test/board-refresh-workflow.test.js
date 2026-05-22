import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_TOKEN_REFRESH_CONFIRM_THRESHOLD,
  STALE_REFRESH_LIMIT,
  TOKEN_REFRESH_CONFIRM_THRESHOLD
} from '../src/boardConstants.js';

const storage = new Map();
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  }
};

function createBoard() {
  return {
    Considering: [{ id: 1, title: 'One' }],
    'Read Docs': [{ id: 2, title: 'Two' }],
    'Asked Maintainer': [{ id: 3, title: 'Three' }],
    Working: [{ id: 4, title: 'Four' }],
    'PR Open': [{ id: 5, title: 'Five' }],
    Merged: [{ id: 6, title: 'Six' }],
    Passed: [{ id: 7, title: 'Seven' }]
  };
}

function createStaleBoard() {
  return {
    Considering: [
      { id: 1, title: 'Never checked' },
      { id: 2, title: 'Old activity', github_activity: { last_checked_at: '2026-05-20T11:59:00.000Z' } },
      { id: 3, title: 'Fresh activity', github_activity: { last_checked_at: '2026-05-22T11:00:00.000Z' } }
    ],
    'Read Docs': [
      { id: 4, title: 'Old refresh', last_refreshed_at: '2026-05-20T12:00:00.000Z' },
      { id: 5, title: 'Fresh refresh', last_refreshed_at: '2026-05-22T11:00:00.000Z' }
    ],
    'Asked Maintainer': [{ id: 6, title: 'Both timestamps fresh wins', last_refreshed_at: '2026-05-20T12:00:00.000Z', github_activity: { last_checked_at: '2026-05-22T11:00:00.000Z' } }],
    Working: [],
    'PR Open': [],
    Merged: [{ id: 7, title: 'Merged stale', github_activity: { last_checked_at: '2026-05-20T12:00:00.000Z' } }],
    Passed: [{ id: 8, title: 'Passed stale' }]
  };
}

test('active board refresh selects active lanes and excludes Merged and Passed', async () => {
  const { getActiveBoardRefreshEntries, getActiveBoardRefreshRequestCount } = await import('../src/boardRefresh.js');
  const entries = getActiveBoardRefreshEntries(createBoard());

  assert.deepEqual(entries.map(entry => entry.column), [
    'Considering',
    'Read Docs',
    'Asked Maintainer',
    'Working',
    'PR Open'
  ]);
  assert.deepEqual(entries.map(entry => entry.card.id), [1, 2, 3, 4, 5]);
  assert.equal(getActiveBoardRefreshRequestCount(createBoard()), 5);
});

test('stale board refresh selects only stale active-lane cards', async () => {
  const { getStaleBoardRefreshEntries, getStaleBoardRefreshRequestCount } = await import('../src/boardRefresh.js');
  const board = createStaleBoard();
  const entries = getStaleBoardRefreshEntries(board, { now: '2026-05-22T12:00:00.000Z' });

  assert.deepEqual(entries.map(entry => entry.card.id), [1, 2, 4]);
  assert.deepEqual(entries.map(entry => entry.column), ['Considering', 'Considering', 'Read Docs']);
  assert.equal(getStaleBoardRefreshRequestCount(board, { now: '2026-05-22T12:00:00.000Z' }), 3);
});

test('stale board refresh caps the primary batch at ten cards', async () => {
  const { getStaleBoardRefreshEntries, getStaleBoardRefreshRequestCount } = await import('../src/boardRefresh.js');
  const board = {
    Considering: Array.from({ length: 12 }, (_, index) => ({ id: index + 1, title: `Card ${index + 1}` })),
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: []
  };

  assert.equal(getStaleBoardRefreshRequestCount(board), STALE_REFRESH_LIMIT);
  assert.deepEqual(getStaleBoardRefreshEntries(board).map(entry => entry.card.id), Array.from({ length: STALE_REFRESH_LIMIT }, (_, index) => index + 1));
});

test('batch refresh confirmations use public and token thresholds', async () => {
  const {
    getBatchRefreshWarning,
    shouldConfirmBatchRefresh
  } = await import('../src/boardRefresh.js');

  assert.equal(shouldConfirmBatchRefresh({ token: '', requestCount: NO_TOKEN_REFRESH_CONFIRM_THRESHOLD }), false);
  assert.equal(shouldConfirmBatchRefresh({ token: '', requestCount: NO_TOKEN_REFRESH_CONFIRM_THRESHOLD + 1 }), true);
  assert.equal(shouldConfirmBatchRefresh({ token: 'sample-token', requestCount: TOKEN_REFRESH_CONFIRM_THRESHOLD }), false);
  assert.equal(shouldConfirmBatchRefresh({ token: 'sample-token', requestCount: TOKEN_REFRESH_CONFIRM_THRESHOLD + 1 }), true);
  assert.equal(
    getBatchRefreshWarning({ requestCount: 8, token: '' }),
    'This will use 8 public GitHub REST API requests. Public GitHub API limits are tight. Add a token or refresh one card at a time.'
  );
  assert.match(
    getBatchRefreshWarning({ requestCount: 26, token: 'sample-token' }),
    /authenticated GitHub REST API requests/
  );
});

test('active board refresh runs serially and keeps final lanes untouched', async () => {
  const { refreshActiveBoardCardsSerially } = await import('../src/boardRefresh.js');
  const calls = [];
  let inFlight = 0;

  const result = await refreshActiveBoardCardsSerially(createBoard(), async (card) => {
    inFlight += 1;
    assert.equal(inFlight, 1);
    calls.push(card.id);
    await Promise.resolve();
    inFlight -= 1;
    return { ...card, refreshed: true };
  });

  assert.deepEqual(calls, [1, 2, 3, 4, 5]);
  assert.equal(result.refreshed, 5);
  assert.equal(result.failed, 0);
  assert.equal(result.nextBoard.Considering[0].refreshed, true);
  assert.equal(result.nextBoard.Merged[0].refreshed, undefined);
  assert.equal(result.nextBoard.Passed[0].refreshed, undefined);
});

test('board refresh can run a stale capped entry list without touching fresh active cards', async () => {
  const { getStaleBoardRefreshEntries, refreshActiveBoardCardsSerially } = await import('../src/boardRefresh.js');
  const board = createStaleBoard();
  const entries = getStaleBoardRefreshEntries(board, { now: '2026-05-22T12:00:00.000Z' });
  const calls = [];

  const result = await refreshActiveBoardCardsSerially(board, async (card) => {
    calls.push(card.id);
    return { ...card, refreshed: true };
  }, { entries });

  assert.deepEqual(calls, [1, 2, 4]);
  assert.equal(result.refreshed, 3);
  assert.equal(result.nextBoard.Considering.find(card => card.id === 3).refreshed, undefined);
  assert.equal(result.nextBoard['Read Docs'].find(card => card.id === 5).refreshed, undefined);
});

test('active board refresh records ordinary failures and continues', async () => {
  const { refreshActiveBoardCardsSerially } = await import('../src/boardRefresh.js');
  const calls = [];

  const result = await refreshActiveBoardCardsSerially(createBoard(), async (card) => {
    calls.push(card.id);
    if (card.id === 2) throw new Error('network failed');
    return { ...card, refreshed: true };
  }, { now: '2026-05-22T16:00:00.000Z' });

  assert.deepEqual(calls, [1, 2, 3, 4, 5]);
  assert.equal(result.refreshed, 4);
  assert.equal(result.failed, 1);
  assert.equal(result.stoppedForRateLimit, false);
  assert.equal(result.nextBoard['Read Docs'][0].refresh_error, 'GitHub refresh failed for this card.');
  assert.equal(result.nextBoard['Asked Maintainer'][0].refreshed, true);
});

test('active board refresh stops remaining requests on rate-limit errors', async () => {
  const { GitHubRefreshRateLimitError } = await import('../src/api/github.js');
  const { refreshActiveBoardCardsSerially } = await import('../src/boardRefresh.js');
  const calls = [];

  const result = await refreshActiveBoardCardsSerially(createBoard(), async (card) => {
    calls.push(card.id);
    if (card.id === 2) {
      throw new GitHubRefreshRateLimitError('GitHub API rate limit reached.', {
        retryAfter: 60,
        rateLimit: { reset: 1770000000 }
      });
    }
    return { ...card, refreshed: true };
  });

  assert.deepEqual(calls, [1, 2]);
  assert.equal(result.refreshed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.stoppedForRateLimit, true);
  assert.match(result.rateLimitMessage, /Retry after 60 seconds/);
  assert.equal(result.nextBoard['Asked Maintainer'][0].refreshed, undefined);
});

test('board refresh workflow avoids Promise.all batching', async () => {
  const source = readFileSync(new URL('../src/boardRefresh.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Promise\.all/);
});
