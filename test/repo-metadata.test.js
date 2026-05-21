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
    },
    dump() {
      return Object.fromEntries(storage.entries());
    }
  };
}

function issueFor(repo) {
  const [owner, name] = repo.split('/');
  return {
    id: `${owner}-${name}`,
    repository_url: `https://api.github.com/repos/${owner}/${name}`,
    repository: { full_name: repo, name }
  };
}

test('repo metadata cache honors a 24 hour TTL and stores only non-secret data', async () => {
  globalThis.localStorage = createLocalStorage();
  const {
    REPO_METADATA_TTL_MS,
    getCachedRepoMetadata,
    setCachedRepoMetadata
  } = await import('../src/api/repoMetadata.js');

  const now = Date.parse('2026-05-21T12:00:00Z');
  setCachedRepoMetadata('openai/codex', {
    full_name: 'openai/codex',
    stargazers_count: 1234,
    authorization: 'Bearer nope',
    token: 'nope'
  }, { now });

  assert.equal(getCachedRepoMetadata('openai/codex', { now: now + REPO_METADATA_TTL_MS - 1 }).stargazers_count, 1234);
  assert.equal(getCachedRepoMetadata('openai/codex', { now: now + REPO_METADATA_TTL_MS + 1 }), null);
  assert.doesNotMatch(JSON.stringify(globalThis.localStorage.dump()), /Bearer|token/i);
});

test('hydrateIssueRepositories parses stargazers_count and limits network concurrency to four', async () => {
  globalThis.localStorage = createLocalStorage();
  const { clearRepoMetadataCache, hydrateIssueRepositories } = await import('../src/api/repoMetadata.js');
  clearRepoMetadataCache();

  let active = 0;
  let maxActive = 0;
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    calls.push(url);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
    const repo = String(url).replace('https://api.github.com/repos/', '');
    return {
      ok: true,
      headers: new Map(),
      json: async () => ({
        full_name: repo,
        name: repo.split('/')[1],
        stargazers_count: 4321,
        forks_count: 22,
        open_issues_count: 33,
        pushed_at: '2026-05-20T00:00:00Z',
        archived: false,
        disabled: false,
        default_branch: 'main',
        language: 'JavaScript',
        topics: ['cli']
      })
    };
  };

  try {
    const hydrated = await hydrateIssueRepositories([
      issueFor('owner/a'),
      issueFor('owner/b'),
      issueFor('owner/c'),
      issueFor('owner/d'),
      issueFor('owner/e')
    ], { token: 'sample-token' });

    assert.equal(maxActive <= 4, true);
    assert.equal(calls.length, 5);
    assert.equal(hydrated[0].repository.stargazers_count, 4321);
    assert.equal(hydrated[0].repository.forks_count, 22);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('filterIssuesByStars applies star thresholds after hydration', async () => {
  const { filterIssuesByStars } = await import('../src/api/repoMetadata.js');

  const issues = [
    { id: 1, repository: { full_name: 'a/a', stargazers_count: 999 } },
    { id: 2, repository: { full_name: 'b/b', stargazers_count: 1000 } },
    { id: 3, repository: { full_name: 'c/c', metadataUnavailable: true } }
  ];

  assert.deepEqual(filterIssuesByStars(issues, '1k+').map(item => item.id), [2, 3]);
});
