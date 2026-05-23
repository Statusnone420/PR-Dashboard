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
    number: 13997,
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13997',
    repository: {
      full_name: 'TEAMMATES/teammates',
      private: false,
      visibility: 'public'
    },
    ...overrides
  };
}

function contentsResponse(path, overrides = {}) {
  return {
    type: 'file',
    path,
    size: 120,
    content: '',
    encoding: 'base64',
    ...overrides
  };
}

test('repo setup contents URLs stay on the GitHub API host', async () => {
  const { buildRepoContentsApiUrl } = await import('../src/api/repoSetup.js');

  assert.equal(
    buildRepoContentsApiUrl(issue(), 'README.md'),
    'https://api.github.com/repos/TEAMMATES/teammates/contents/README.md'
  );
  assert.equal(
    buildRepoContentsApiUrl(issue(), '.github/workflows'),
    'https://api.github.com/repos/TEAMMATES/teammates/contents/.github/workflows'
  );
  assert.throws(() => buildRepoContentsApiUrl({
    html_url: 'https://evil.example/owner/repo/issues/1',
    repository: { full_name: 'owner/repo' }
  }, 'README.md'), /valid GitHub issue/);
});

test('fetchRepoSetupEnrichment detects setup docs, workflow, and test hints compactly', async () => {
  const { SCORE_ENRICHMENT_CACHE_KEY } = await import('../src/api/issueComments.js');
  const { fetchRepoSetupEnrichment, getCachedRepoSetupEnrichment } = await import('../src/api/repoSetup.js');
  const storage = createLocalStorage();
  const requests = [];

  const packageJson = Buffer.from(JSON.stringify({
    scripts: {
      test: 'vitest',
      build: 'vite build'
    },
    devDependencies: {
      vite: '^5.0.0'
    }
  })).toString('base64');

  const result = await fetchRepoSetupEnrichment(issue(), {
    token: 'sample-token',
    now: Date.parse('2026-05-23T12:00:00.000Z'),
    storage,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith('/README.md')) {
        return new Response(JSON.stringify(contentsResponse('README.md')), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/CONTRIBUTING.md')) {
        return new Response(JSON.stringify(contentsResponse('CONTRIBUTING.md')), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/package.json')) {
        return new Response(JSON.stringify(contentsResponse('package.json', { content: packageJson, size: packageJson.length })), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/.github/workflows')) {
        return new Response(JSON.stringify([{ type: 'file', path: '.github/workflows/ci.yml' }]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    }
  });

  assert.equal(requests.every(request => request.init.method === 'GET'), true);
  assert.equal(requests.length <= 8, true);
  assert.equal(result.summary.setupDocsPresent, true);
  assert.equal(result.summary.contributingPresent, true);
  assert.equal(result.summary.workflowPresent, true);
  assert.equal(result.summary.configHintsPresent, true);
  assert.equal(result.summary.testHintsPresent, true);
  assert.equal(result.summary.setupUnclear, false);
  assert.equal(getCachedRepoSetupEnrichment(issue(), storage, { now: Date.parse('2026-05-23T13:00:00.000Z') }).summary.workflowPresent, true);
  assert.doesNotMatch(storage.getItem(SCORE_ENRICHMENT_CACHE_KEY), /sample-token|Authorization|Bearer|vitest|vite build/i);
});

test('repo setup summary stays cautious when setup files are missing', async () => {
  const { fetchRepoSetupEnrichment } = await import('../src/api/repoSetup.js');

  const result = await fetchRepoSetupEnrichment(issue(), {
    storage: createLocalStorage(),
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    })
  });

  assert.equal(result.summary.inspected, true);
  assert.equal(result.summary.setupDocsPresent, false);
  assert.equal(result.summary.workflowPresent, false);
  assert.equal(result.summary.setupUnclear, true);
  assert.deepEqual(result.summary.reasons, ['Setup files look unclear']);
});
