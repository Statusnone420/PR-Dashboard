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

test('contribution preferences save, load, normalize, and clear allowed fields only', async () => {
  const storage = createLocalStorage();
  const {
    CONTRIBUTION_PREFERENCES_STORAGE_KEY,
    clearContributionPreferences,
    loadContributionPreferences,
    saveContributionPreferences
  } = await import('../src/contributionPreferences.js');

  const saved = saveContributionPreferences({
    languages: ['TypeScript', ' ', 42],
    preferredWork: ['docs', 'tests'],
    avoidWork: ['refactor'],
    experience: 'first-pr',
    timeBudget: 'under-1-hour',
    token: 'never-store',
    email: 'private@example.com',
    privateRepos: ['owner/private'],
    saved_at: '2026-05-23T12:00:00.000Z'
  }, storage);

  assert.deepEqual(saved, {
    version: 1,
    languages: ['TypeScript'],
    preferredWork: ['docs', 'tests'],
    avoidWork: ['refactor'],
    experience: 'first-pr',
    timeBudget: 'under-1-hour',
    saved_at: '2026-05-23T12:00:00.000Z'
  });
  assert.doesNotMatch(storage.getItem(CONTRIBUTION_PREFERENCES_STORAGE_KEY), /token|private@example|privateRepos|owner\/private/i);
  assert.deepEqual(loadContributionPreferences(storage), saved);

  clearContributionPreferences(storage);
  assert.equal(loadContributionPreferences(storage), null);
});

test('contribution preference import merge keeps newer saved_at and drops malformed fields', async () => {
  const { mergeContributionPreferences, normalizeContributionPreferences } = await import('../src/contributionPreferences.js');

  const current = normalizeContributionPreferences({
    languages: ['Rust'],
    preferredWork: ['tests'],
    avoidWork: [],
    experience: 'comfortable',
    timeBudget: 'half-day',
    saved_at: '2026-05-23T12:00:00.000Z'
  });
  const olderImport = normalizeContributionPreferences({
    languages: ['Go'],
    preferredWork: ['backend'],
    avoidWork: ['docs'],
    experience: 'not-allowed',
    timeBudget: 'also-bad',
    token: 'never-store',
    saved_at: '2026-05-22T12:00:00.000Z'
  });
  const newerImport = normalizeContributionPreferences({
    languages: ['TypeScript'],
    preferredWork: ['docs'],
    avoidWork: ['migration'],
    experience: 'first-pr',
    timeBudget: 'weekend',
    email: 'private@example.com',
    saved_at: '2026-05-24T12:00:00.000Z'
  });

  assert.equal(olderImport.experience, '');
  assert.equal(olderImport.timeBudget, '');
  assert.deepEqual(mergeContributionPreferences(current, olderImport), current);
  assert.deepEqual(mergeContributionPreferences(current, newerImport), {
    version: 1,
    languages: ['TypeScript'],
    preferredWork: ['docs'],
    avoidWork: ['migration'],
    experience: 'first-pr',
    timeBudget: 'weekend',
    saved_at: '2026-05-24T12:00:00.000Z'
  });
});
