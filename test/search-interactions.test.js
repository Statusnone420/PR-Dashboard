import test from 'node:test';
import assert from 'node:assert/strict';

test('filter changes update state without running a GitHub search', async () => {
  const { applyFilterPatch } = await import('../src/searchInteractions.js');
  let searchCalls = 0;
  const fakeStore = {
    setFilters(patch) {
      this.patch = patch;
    }
  };

  applyFilterPatch(fakeStore, { labels: ['help wanted'] }, () => {
    searchCalls += 1;
  });

  assert.deepEqual(fakeStore.patch, { labels: ['help wanted'] });
  assert.equal(searchCalls, 0);
});

test('quick-wins preset keeps beginner labels in OR mode and runs one explicit search', async () => {
  const { applyPresetSearch } = await import('../src/searchInteractions.js');
  let searchCalls = 0;
  const fakeStore = {
    searchQuery: 'parser',
    setFilters(patch) {
      this.patch = patch;
    }
  };

  applyPresetSearch(fakeStore, 'quick-wins', () => {
    searchCalls += 1;
  });

  assert.deepEqual(fakeStore.patch, {
    labels: ['good first issue', 'help wanted'],
    labelMode: 'OR',
    comments: 'Low (0-5)',
    stars: '1k+'
  });
  assert.equal(searchCalls, 1);
});
