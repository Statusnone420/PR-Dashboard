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

test('board cards persist after save and column moves', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const firstStore = new AppStore();
  firstStore.boardCards = {
    Considering: [],
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: []
  };

  firstStore.saveIssueToBoard({
    id: 987654321,
    number: 42,
    title: 'Safe public issue',
    body: 'Issue body',
    updated_at: '2026-05-20T00:00:00Z',
    labels: [],
    comments: 0,
    repository: {
      name: 'example',
      full_name: 'openai/example',
      stargazers_count: 1000
    },
    html_url: 'https://github.com/openai/example/issues/42'
  });
  firstStore.moveBoardCard(987654321, 1);

  const secondStore = new AppStore();
  assert.equal(secondStore.boardCards.Considering.some(card => card.id === 987654321), false);
  assert.equal(secondStore.boardCards['Read Docs'].some(card => card.id === 987654321), true);
});

test('clearing token does not wipe persisted board cards', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.boardCards = {
    Considering: [{ id: 123, title: 'Keep me' }],
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: []
  };
  appStore.saveBoardToStorage();
  appStore.updateToken('sample-token', true);

  appStore.clearToken();

  assert.equal(globalThis.localStorage.getItem('pr_dashboard_token'), null);
  assert.match(globalThis.localStorage.getItem('pr_dashboard_board_cards'), /Keep me/);
});
