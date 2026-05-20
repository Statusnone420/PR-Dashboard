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

test('createGitHubHeaders only attaches Authorization for api.github.com', async () => {
  const { createGitHubHeaders } = await import('../src/api/github.js');
  const sampleToken = 'sample-token';

  assert.equal(createGitHubHeaders('https://github.com/openai/openai-node/issues/1', sampleToken).Authorization, undefined);
  assert.equal(createGitHubHeaders('https://api.github.com/search/issues?q=test', '').Authorization, undefined);
  assert.equal(createGitHubHeaders('https://api.github.com/search/issues?q=test', sampleToken).Authorization, `Bearer ${sampleToken}`);
});

test('createGitHubRequestOptions blocks non-api and write GitHub requests', async () => {
  const { createGitHubRequestOptions } = await import('../src/api/github.js');

  assert.throws(
    () => createGitHubRequestOptions('https://github.com/openai/openai-node/issues/1', 'sample-token'),
    /only https:\/\/api\.github\.com/
  );

  assert.throws(
    () => createGitHubRequestOptions('https://api.github.com/repos/openai/openai-node/issues/1', 'sample-token', { method: 'PATCH' }),
    /read-only/
  );
});
