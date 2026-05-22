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
  appStore.updateToken(['sample', 'credential'].join('-'), true);

  appStore.clearToken();

  assert.equal(globalThis.localStorage.getItem('pr_dashboard_token'), null);
  assert.match(globalThis.localStorage.getItem('pr_dashboard_board_cards'), /Keep me/);
});

test('normal production startup does not seed mock board cards', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  const totalCards = Object.values(appStore.boardCards).flat().length;

  assert.equal(totalCards, 0);
});

test('old seeded mock board cards are removed during board migration', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { mockBoardCards } = await import('../src/data/mockData.js');

  globalThis.localStorage.setItem('pr_dashboard_board_cards', JSON.stringify(mockBoardCards));

  const appStore = new AppStore();
  const allCards = Object.values(appStore.boardCards).flat();

  assert.equal(allCards.length, 0);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_board_migration_v1'), 'seeded-mock-cards-removed');
});

test('hiding an issue also removes that issue from the saved board', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 1,
    number: 10,
    title: 'Hide me',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });
  appStore.saveIssueToBoard({
    id: 2,
    number: 11,
    title: 'Keep me',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/11'
  });

  appStore.hideIssue({
    id: 1,
    number: 10,
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });

  const remaining = Object.values(appStore.boardCards).flat();
  assert.deepEqual(remaining.map(card => card.id), [2]);
});

test('hiding a repo also removes saved board cards from that repo', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 1,
    number: 10,
    title: 'Repo hide me',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });
  appStore.saveIssueToBoard({
    id: 2,
    number: 20,
    title: 'Other repo',
    repository: { full_name: 'vercel/next.js' },
    html_url: 'https://github.com/vercel/next.js/issues/20'
  });

  appStore.hideRepo({
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });

  const remaining = Object.values(appStore.boardCards).flat();
  assert.deepEqual(remaining.map(card => card.id), [2]);
});
