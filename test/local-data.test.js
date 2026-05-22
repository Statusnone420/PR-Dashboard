import test from 'node:test';
import assert from 'node:assert/strict';

function createLocalStorage() {
  const storage = new Map();
  return {
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
}

test('exported local data excludes token and repo metadata cache', async () => {
  const storage = createLocalStorage();
  const { exportLocalData } = await import('../src/localData.js');
  storage.setItem('pr_dashboard_token', 'secret-token');
  storage.setItem('pr_dashboard_repo_metadata_cache_v1', JSON.stringify({ 'owner/repo': { stargazers_count: 1 } }));
  storage.setItem('pr_dashboard_board_cards', JSON.stringify({ Considering: [{ id: 1, number: 1, repository: { full_name: 'Owner/Repo' } }] }));

  const exported = exportLocalData(storage, { now: '2026-05-22T12:00:00.000Z' });

  assert.equal(exported.version, 1);
  assert.equal(exported.exported_at, '2026-05-22T12:00:00.000Z');
  assert.equal(exported.token, undefined);
  assert.equal(exported.repoMetadata, undefined);
  assert.doesNotMatch(JSON.stringify(exported), /secret-token|repo_metadata_cache/i);
});

test('imported local data ignores token and repo metadata cache fields', async () => {
  const storage = createLocalStorage();
  const { importLocalData } = await import('../src/localData.js');

  importLocalData(storage, {
    version: 1,
    token: 'imported-secret-token',
    rememberToken: true,
    repoMetadata: { 'owner/repo': { stargazers_count: 999 } },
    boardCards: {
      Considering: [{
        id: 1,
        number: 1,
        title: 'Portable card',
        repository: { full_name: 'Owner/Repo' }
      }]
    }
  });

  assert.equal(storage.getItem('pr_dashboard_token'), null);
  assert.equal(storage.getItem('pr_dashboard_remember_token'), null);
  assert.equal(storage.getItem('pr_dashboard_repo_metadata_cache_v1'), null);
});

test('import merges board cards by canonical issue before numeric id and keeps one lane', async () => {
  const storage = createLocalStorage();
  const { importLocalData } = await import('../src/localData.js');
  storage.setItem('pr_dashboard_board_cards', JSON.stringify({
    Considering: [{
      id: 1,
      number: 13997,
      title: 'Older workflow',
      repository: { full_name: 'TEAMMATES/teammates' },
      column_entered_at: '2026-05-20T12:00:00.000Z'
    }],
    Working: [],
    Merged: []
  }));

  importLocalData(storage, {
    version: 1,
    boardCards: {
      Working: [{
        id: 99,
        number: 13997,
        title: 'Newer workflow',
        repository: { full_name: 'teammates/teammates' },
        column_entered_at: '2026-05-22T12:00:00.000Z'
      }]
    }
  });

  const board = JSON.parse(storage.getItem('pr_dashboard_board_cards'));
  const allCards = Object.values(board).flat();
  assert.equal(allCards.length, 1);
  assert.equal(board.Working[0].title, 'Newer workflow');
  assert.equal(board.Considering.length, 0);
});
