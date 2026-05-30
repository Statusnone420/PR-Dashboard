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

test('quick-wins preset uses beginner difficulty, low comments, and unassigned routing', async () => {
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
    difficulty: 'Beginner',
    labels: [],
    labelMode: 'OR',
    comments: 'Low (0-5)',
    stars: 'Any',
    updatedDate: 'Any',
    includeClosed: false,
    unassigned: true
  });
  assert.equal(searchCalls, 1);
});

test('deep-dives preset uses advanced difficulty and availability labels', async () => {
  const { getPresetFilterPatch } = await import('../src/searchInteractions.js');

  assert.deepEqual(getPresetFilterPatch('deep-dives'), {
    difficulty: 'Advanced',
    labels: ['help wanted'],
    labelMode: 'OR',
    comments: 'Any',
    stars: 'Any',
    updatedDate: 'Any',
    includeClosed: false,
    unassigned: false
  });
});

test('tests preset targets testing work without assuming starter difficulty', async () => {
  const { getPresetFilterPatch } = await import('../src/searchInteractions.js');

  assert.deepEqual(getPresetFilterPatch('tests'), {
    difficulty: 'Any',
    labels: ['testing', 'type:testing'],
    labelMode: 'OR',
    comments: 'Low (0-5)',
    stars: 'Any',
    updatedDate: 'Any',
    includeClosed: false,
    unassigned: true
  });
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
    difficulty: 'Any',
    labels: ['help wanted'],
    labelMode: 'OR',
    comments: 'Low (0-5)',
    stars: 'Any',
    updatedDate: 'Last month',
    includeClosed: false,
    unassigned: true
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
    difficulty: 'Any',
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

test('target platform scoring respects lookup filter opt-in', async () => {
  const { getScoreTargetPlatformsForMode } = await import('../src/searchInteractions.js');
  const { TARGET_PLATFORM_KEYS } = await import('../src/platformFilters.js');

  assert.deepEqual(getScoreTargetPlatformsForMode({
    targetPlatforms: ['windows'],
    useFiltersInLookup: false
  }, 'lookup'), TARGET_PLATFORM_KEYS);
  assert.deepEqual(getScoreTargetPlatformsForMode({
    targetPlatforms: ['windows'],
    useFiltersInLookup: true
  }, 'lookup'), ['windows']);
  assert.deepEqual(getScoreTargetPlatformsForMode({
    targetPlatforms: ['windows'],
    useFiltersInLookup: false
  }, 'find'), ['windows']);
});

test('finder intent normalizes applied filters for match scoring', async () => {
  const { buildFinderIntent } = await import('../src/searchInteractions.js');

  const intent = buildFinderIntent({
    labels: ['help wanted', 'help wanted', 'docs'],
    labelMode: 'AND',
    stars: '5k+',
    comments: 'Low (0-5)',
    updatedDate: 'Last month',
    unassigned: true,
    difficulty: 'Intermediate',
    targetPlatforms: ['linux']
  }, {
    preferredWork: ['docs'],
    avoidWork: ['migration']
  });

  assert.deepEqual(intent.selectedLabels, ['help wanted', 'docs']);
  assert.equal(intent.labelMode, 'AND');
  assert.equal(intent.starsThreshold, 5000);
  assert.deepEqual(intent.commentsRange, { min: 0, max: 5, label: 'Low (0-5)' });
  assert.equal(intent.updatedDateDays, 30);
  assert.equal(intent.unassignedOnly, true);
  assert.equal(intent.difficulty, 'Intermediate');
  assert.deepEqual(intent.targetPlatforms, ['linux']);
  assert.deepEqual(intent.profile.preferredWork, ['docs']);
});
