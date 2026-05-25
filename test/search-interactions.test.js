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

test('low-noise preset applies quiet filters and runs one explicit search', async () => {
  const { applyPresetSearch } = await import('../src/searchInteractions.js');
  let searchCalls = 0;
  const fakeStore = {
    searchQuery: 'accessibility',
    setFilters(patch) {
      this.patch = patch;
    }
  };

  applyPresetSearch(fakeStore, 'low-noise', () => {
    searchCalls += 1;
  });

  assert.deepEqual(fakeStore.patch, {
    labels: ['help wanted'],
    labelMode: 'OR',
    comments: 'Low (0-5)',
    stars: 'Any',
    updatedDate: 'Last month'
  });
  assert.equal(searchCalls, 1);
});

test('broaden search clears contribution filters instead of swapping labels', async () => {
  const { getRelaxedFilters } = await import('../src/searchInteractions.js');
  const { TARGET_PLATFORM_KEYS } = await import('../src/platformFilters.js');

  assert.deepEqual(getRelaxedFilters(), {
    languages: [],
    labels: [],
    labelMode: 'OR',
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    includeClosed: false,
    unassigned: false,
    targetPlatforms: TARGET_PLATFORM_KEYS
  });
});

test('target platform result filtering respects lookup filter opt-in', async () => {
  const { shouldApplyTargetPlatformResultFilter } = await import('../src/searchInteractions.js');

  assert.equal(shouldApplyTargetPlatformResultFilter({ useFiltersInLookup: false }, 'lookup'), false);
  assert.equal(shouldApplyTargetPlatformResultFilter({ useFiltersInLookup: true }, 'lookup'), true);
  assert.equal(shouldApplyTargetPlatformResultFilter({ useFiltersInLookup: false }, 'find'), true);
});
