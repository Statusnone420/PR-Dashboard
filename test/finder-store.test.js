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

test('filter draft changes do not alter applied filters until Apply Filters is used', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.setDraftFilters({ stars: '5k+' });

  assert.equal(appStore.draftFilters.stars, '5k+');
  assert.equal(appStore.filters.stars, 'Any');
  assert.equal(appStore.hasDraftFilterChanges(), true);

  appStore.applyDraftFilters();

  assert.equal(appStore.filters.stars, '5k+');
  assert.equal(appStore.hasDraftFilterChanges(), false);
});

test('new saved issues use recon-first action plan copy', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 1,
    number: 1,
    title: 'Fix docs',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/1'
  });

  const taskTexts = appStore.boardCards.Considering[0].checklist.map(task => task.text);
  assert.deepEqual(taskTexts, [
    'Read README.',
    'Read CONTRIBUTING.md.',
    'Check install/test command.',
    'Identify likely files.',
    'Open issue discussion.',
    'Decide attempt/pass.'
  ]);
});

test('known legacy default action plans migrate without rewriting custom tasks', async () => {
  globalThis.localStorage = createLocalStorage();
  globalThis.localStorage.setItem('pr_dashboard_board_cards', JSON.stringify({
    Considering: [
      {
        id: 1,
        title: 'Legacy defaults',
        checklist: [
          { text: 'Fork repository', completed: true },
          { text: 'Clone repository', completed: false },
          { text: 'Setup local environment', completed: false },
          { text: 'Draft PR for feedback', completed: false }
        ]
      },
      {
        id: 2,
        title: 'Custom task',
        checklist: [{ text: 'Ask Alice whether this is still wanted', completed: false }]
      }
    ],
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: []
  }));

  const { AppStore } = await import('../src/state/store.js');
  const appStore = new AppStore();

  assert.deepEqual(appStore.boardCards.Considering[0].checklist.map(task => task.text), [
    'Read README.',
    'Read CONTRIBUTING.md.',
    'Check install/test command.',
    'Identify likely files.',
    'Open issue discussion.',
    'Decide attempt/pass.'
  ]);
  assert.deepEqual(appStore.boardCards.Considering[1].checklist.map(task => task.text), [
    'Ask Alice whether this is still wanted'
  ]);
});

test('inspector checklist toggles persist saved cards outside Working', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 10,
    number: 10,
    title: 'Fix docs',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });
  appStore.setInspectedIssue({
    id: 10,
    number: 10,
    title: 'Fix docs',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });

  appStore.toggleTaskChecklist(10, 'Read README.', true);

  assert.equal(appStore.boardCards.Considering[0].checklist[0].completed, true);
  assert.equal(appStore.boardCards.Considering[0].progress, 17);
  assert.equal(appStore.inspectedIssue.checklist[0].completed, true);
  assert.equal(appStore.inspectedIssue.progress, 17);
});
