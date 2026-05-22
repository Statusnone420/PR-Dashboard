import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

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

test('public active-board refresh warns only above five requests without a token', async () => {
  const {
    getPublicBatchRefreshWarning,
    shouldWarnPublicBatchRefresh
  } = await import('../src/boardRefresh.js');

  assert.equal(shouldWarnPublicBatchRefresh({ token: '', requestCount: 5 }), false);
  assert.equal(shouldWarnPublicBatchRefresh({ token: '', requestCount: 6 }), true);
  assert.equal(shouldWarnPublicBatchRefresh({ token: 'sample-token', requestCount: 10 }), false);
  assert.equal(
    getPublicBatchRefreshWarning(8),
    'This will use 8 public GitHub API requests. Public GitHub API limits are tight. Add a token or refresh one card at a time.'
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
