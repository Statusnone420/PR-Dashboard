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

function issue(overrides = {}) {
  return {
    id: 1,
    number: 10,
    title: 'Do not store this title',
    body: 'Do not store this body',
    labels: [{ name: 'bug' }],
    repository: {
      full_name: 'openai/codex',
      pushed_at: '2026-05-20T12:00:00Z'
    },
    html_url: 'https://github.com/openai/codex/issues/10',
    ...overrides
  };
}

test('hidden issue disappears from visible issue lists', async () => {
  globalThis.localStorage = createLocalStorage();
  const { hideIssue, filterHiddenIssues } = await import('../src/hiddenItems.js');
  const hidden = issue();
  const visible = issue({
    id: 2,
    number: 11,
    html_url: 'https://github.com/openai/codex/issues/11'
  });

  hideIssue(hidden);

  assert.deepEqual(filterHiddenIssues([hidden, visible]).map(item => item.number), [11]);
});

test('hidden repo removes all results from that repo', async () => {
  globalThis.localStorage = createLocalStorage();
  const { hideRepo, filterHiddenIssues } = await import('../src/hiddenItems.js');
  const codexOne = issue({ id: 1, number: 10 });
  const codexTwo = issue({ id: 2, number: 11, html_url: 'https://github.com/openai/codex/issues/11' });
  const otherRepo = issue({
    id: 3,
    number: 12,
    repository: { full_name: 'vercel/next.js' },
    html_url: 'https://github.com/vercel/next.js/issues/12'
  });

  hideRepo(codexOne);

  assert.deepEqual(filterHiddenIssues([codexOne, codexTwo, otherRepo]).map(item => item.repository.full_name), ['vercel/next.js']);
});

test('hidden storage stays compact', async () => {
  globalThis.localStorage = createLocalStorage();
  const { HIDDEN_STORAGE_KEY, hideIssue, loadHiddenItems } = await import('../src/hiddenItems.js');

  hideIssue(issue());
  globalThis.localStorage.setItem('unrelated_token', 'keep outside hidden payload');

  const raw = globalThis.localStorage.getItem(HIDDEN_STORAGE_KEY);
  assert.deepEqual(loadHiddenItems(globalThis.localStorage).version, 1);
  assert.match(raw, /"issues":\{"openai\/codex#10":\d+\}/);
  assert.doesNotMatch(raw, /Do not store this title|Do not store this body|labels|pushed_at|metadata|token/i);
});

test('clear hidden restores normal visibility on the next render pass', async () => {
  globalThis.localStorage = createLocalStorage();
  const { clearHiddenItems, filterHiddenIssues, hideIssue } = await import('../src/hiddenItems.js');
  const target = issue();

  hideIssue(target);
  assert.deepEqual(filterHiddenIssues([target]), []);

  clearHiddenItems();
  assert.deepEqual(filterHiddenIssues([target]).map(item => item.number), [10]);
});

test('listHiddenItems returns issue and repo rows with keys, timestamps, and GitHub URLs', async () => {
  globalThis.localStorage = createLocalStorage();
  const { HIDDEN_STORAGE_KEY, listHiddenItems } = await import('../src/hiddenItems.js');
  globalThis.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify({
    version: 1,
    issues: {
      'openai/codex#10': 1770000000000
    },
    repos: {
      'vercel/next.js': 1770000001000
    }
  }));

  const hidden = listHiddenItems(globalThis.localStorage);

  assert.deepEqual(hidden.issues, [{
    key: 'openai/codex#10',
    hiddenAt: 1770000000000,
    url: 'https://github.com/openai/codex/issues/10'
  }]);
  assert.deepEqual(hidden.repos, [{
    key: 'vercel/next.js',
    hiddenAt: 1770000001000,
    url: 'https://github.com/vercel/next.js'
  }]);
});

test('unhideIssueKey removes only the selected issue', async () => {
  globalThis.localStorage = createLocalStorage();
  const { HIDDEN_STORAGE_KEY, listHiddenItems, unhideIssueKey } = await import('../src/hiddenItems.js');
  globalThis.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify({
    version: 1,
    issues: {
      'openai/codex#10': 1770000000000,
      'openai/codex#11': 1770000001000
    },
    repos: {
      'openai/codex': 1770000002000
    }
  }));

  unhideIssueKey('openai/codex#10', globalThis.localStorage);
  const hidden = listHiddenItems(globalThis.localStorage);

  assert.deepEqual(hidden.issues.map(item => item.key), ['openai/codex#11']);
  assert.deepEqual(hidden.repos.map(item => item.key), ['openai/codex']);
});

test('unhideRepoKey removes only the selected repo', async () => {
  globalThis.localStorage = createLocalStorage();
  const { HIDDEN_STORAGE_KEY, listHiddenItems, unhideRepoKey } = await import('../src/hiddenItems.js');
  globalThis.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify({
    version: 1,
    issues: {
      'openai/codex#10': 1770000000000
    },
    repos: {
      'openai/codex': 1770000001000,
      'vercel/next.js': 1770000002000
    }
  }));

  unhideRepoKey('openai/codex', globalThis.localStorage);
  const hidden = listHiddenItems(globalThis.localStorage);

  assert.deepEqual(hidden.issues.map(item => item.key), ['openai/codex#10']);
  assert.deepEqual(hidden.repos.map(item => item.key), ['vercel/next.js']);
});
