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

  const raw = globalThis.localStorage.getItem(HIDDEN_STORAGE_KEY);
  assert.deepEqual(loadHiddenItems(globalThis.localStorage).version, 1);
  assert.match(raw, /"issues":\{"openai\/codex#10":\d+\}/);
  assert.doesNotMatch(raw, /Do not store this title|Do not store this body|labels|pushed_at|token/i);
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
