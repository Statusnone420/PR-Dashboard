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

test('profile stores non-secret GitHub identity and derives initials without avatar images', async () => {
  const storage = createLocalStorage();
  const { getProfileInitials, loadProfile, saveProfileFromGitHubUser } = await import('../src/profile.js');

  saveProfileFromGitHubUser({
    login: 'Statusnone420',
    name: 'Anthony Stone',
    avatar_url: 'https://avatars.githubusercontent.com/u/123',
    html_url: 'https://github.com/Statusnone420',
    token: 'never-store'
  }, storage, { now: '2026-05-22T12:00:00.000Z' });

  const profile = loadProfile(storage);
  assert.equal(profile.login, 'Statusnone420');
  assert.equal(profile.name, 'Anthony Stone');
  assert.equal(profile.github_url, 'https://github.com/Statusnone420');
  assert.equal(profile.avatar_url, undefined);
  assert.equal(getProfileInitials(profile), 'ST');
  assert.doesNotMatch(JSON.stringify(profile), /avatar|token|never-store/i);
});

test('profile initials fall back to GH', async () => {
  const { getProfileInitials } = await import('../src/profile.js');

  assert.equal(getProfileInitials(null), 'GH');
  assert.equal(getProfileInitials({ login: '' }), 'GH');
});
