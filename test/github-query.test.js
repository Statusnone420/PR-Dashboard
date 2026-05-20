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

test('buildQueryString uses OR for selected beginner-friendly labels by default', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('parser', {
    languages: [],
    labels: ['good first issue', 'help wanted'],
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score'
  });

  assert.match(query, /\(label:"good first issue" OR label:"help wanted"\)/);
  assert.doesNotMatch(query, /label:"good first issue" label:"help wanted"/);
});

test('buildQueryString supports explicit AND label behavior', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('', {
    languages: [],
    labels: ['bug', 'performance'],
    labelMode: 'AND',
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score'
  });

  assert.match(query, /label:"bug" label:"performance"/);
});
