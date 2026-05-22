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

test('profile stores only whitelisted GitHub identity fields including avatar', async () => {
  const storage = createLocalStorage();
  const { getProfileInitials, loadProfile, saveProfileFromGitHubUser } = await import('../src/profile.js');

  saveProfileFromGitHubUser({
    id: 12345,
    login: 'Statusnone420',
    name: 'Anthony Stone',
    avatar_url: 'https://avatars.githubusercontent.com/u/123?v=4',
    html_url: 'https://github.com/Statusnone420',
    token: 'never-store',
    email: 'private@example.com',
    company: 'Private Co',
    location: 'Private City',
    bio: 'Private bio',
    plan: { name: 'pro' },
    total_private_repos: 99,
    disk_usage: 1234,
    collaborators: 42
  }, storage, { now: '2026-05-22T12:00:00.000Z' });

  const profile = loadProfile(storage);
  assert.equal(profile.github_id, '12345');
  assert.equal(profile.login, 'Statusnone420');
  assert.equal(profile.name, 'Anthony Stone');
  assert.equal(profile.github_url, 'https://github.com/Statusnone420');
  assert.equal(profile.avatar_url, 'https://avatars.githubusercontent.com/u/123?v=4');
  assert.equal(getProfileInitials(profile), 'ST');
  assert.doesNotMatch(
    JSON.stringify(profile),
    /token|never-store|private@example|Private Co|Private City|Private bio|plan|total_private_repos|disk_usage|collaborators/i
  );
});

test('profile initials fall back to GH', async () => {
  const { getProfileInitials } = await import('../src/profile.js');

  assert.equal(getProfileInitials(null), 'GH');
  assert.equal(getProfileInitials({ login: '' }), 'GH');
});
