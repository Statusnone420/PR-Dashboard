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

function createCountingLocalStorage() {
  const storage = createLocalStorage();
  let getItemCalls = 0;
  return {
    getItem(key) {
      getItemCalls += 1;
      return storage.getItem(key);
    },
    setItem(key, value) {
      storage.setItem(key, value);
    },
    removeItem(key) {
      storage.removeItem(key);
    },
    resetCounts() {
      getItemCalls = 0;
    },
    get getItemCalls() {
      return getItemCalls;
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
    buildRepoContentsApiUrl(issue(), ''),
    'https://api.github.com/repos/TEAMMATES/teammates/contents'
  );
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

test('fetchRepoSetupEnrichment starts from root listing and skips absent optional manifests', async () => {
  const { fetchRepoSetupEnrichment } = await import('../src/api/repoSetup.js');
  const requests = [];

  const result = await fetchRepoSetupEnrichment(issue(), {
    storage: createLocalStorage(),
    fetchImpl: async (url) => {
      requests.push(url);
      if (url.endsWith('/contents')) {
        return new Response(JSON.stringify([
          { type: 'file', name: 'README.md', path: 'README.md' }
        ]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/contents/README.md')) {
        return new Response(JSON.stringify(contentsResponse('README.md')), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (/\/(package\.json|pyproject\.toml|pom\.xml|\.github\/workflows)$/.test(url)) {
        throw new Error(`unexpected optional setup probe: ${url}`);
      }
      return new Response(JSON.stringify({ message: 'Not Found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  assert.equal(result.summary.inspected, true);
  assert.equal(result.summary.setupDocsPresent, true);
  assert.equal(result.summary.configHintsPresent, false);
  assert.equal(result.summary.workflowPresent, false);
  assert.equal(result.summary.setupUnclear, false);
  assert.deepEqual(requests, [
    'https://api.github.com/repos/TEAMMATES/teammates/contents',
    'https://api.github.com/repos/TEAMMATES/teammates/contents/README.md'
  ]);
});

test('fetchRepoSetupEnrichment only inspects discoverable setup directories and files', async () => {
  const { fetchRepoSetupEnrichment } = await import('../src/api/repoSetup.js');
  const requests = [];
  const packageJson = Buffer.from(JSON.stringify({
    scripts: {
      test: 'node --test',
      build: 'vite build'
    }
  })).toString('base64');

  const result = await fetchRepoSetupEnrichment(issue(), {
    storage: createLocalStorage(),
    fetchImpl: async (url) => {
      requests.push(url);
      if (url.endsWith('/contents')) {
        return new Response(JSON.stringify([
          { type: 'file', name: 'README.md', path: 'README.md' },
          { type: 'file', name: 'package.json', path: 'package.json' },
          { type: 'file', name: 'pyproject.toml', path: 'pyproject.toml' },
          { type: 'file', name: 'pom.xml', path: 'pom.xml' },
          { type: 'dir', name: '.github', path: '.github' },
          { type: 'dir', name: 'docs', path: 'docs' }
        ]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/contents/.github')) {
        return new Response(JSON.stringify([
          { type: 'dir', name: 'workflows', path: '.github/workflows' }
        ]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/contents/.github/workflows')) {
        return new Response(JSON.stringify([
          { type: 'file', name: 'ci.yml', path: '.github/workflows/ci.yml' }
        ]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/contents/docs')) {
        return new Response(JSON.stringify([
          { type: 'file', name: 'CONTRIBUTING.md', path: 'docs/CONTRIBUTING.md' }
        ]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/contents/docs/CONTRIBUTING.md')) {
        return new Response(JSON.stringify(contentsResponse('docs/CONTRIBUTING.md')), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/contents/package.json')) {
        return new Response(JSON.stringify(contentsResponse('package.json', { content: packageJson, size: packageJson.length })), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/contents/README.md')) {
        return new Response(JSON.stringify(contentsResponse('README.md')), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/contents/pyproject.toml')) {
        return new Response(JSON.stringify(contentsResponse('pyproject.toml', { content: Buffer.from('[tool.pytest.ini_options]').toString('base64') })), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/contents/pom.xml')) {
        return new Response(JSON.stringify(contentsResponse('pom.xml', { content: Buffer.from('<project><build></build></project>').toString('base64') })), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`unexpected setup request: ${url}`);
    }
  });

  assert.deepEqual(requests, [
    'https://api.github.com/repos/TEAMMATES/teammates/contents',
    'https://api.github.com/repos/TEAMMATES/teammates/contents/README.md',
    'https://api.github.com/repos/TEAMMATES/teammates/contents/package.json',
    'https://api.github.com/repos/TEAMMATES/teammates/contents/pyproject.toml',
    'https://api.github.com/repos/TEAMMATES/teammates/contents/pom.xml',
    'https://api.github.com/repos/TEAMMATES/teammates/contents/.github',
    'https://api.github.com/repos/TEAMMATES/teammates/contents/.github/workflows',
    'https://api.github.com/repos/TEAMMATES/teammates/contents/docs',
    'https://api.github.com/repos/TEAMMATES/teammates/contents/docs/CONTRIBUTING.md'
  ]);
  assert.equal(result.summary.setupDocsPresent, true);
  assert.equal(result.summary.contributingPresent, true);
  assert.equal(result.summary.workflowPresent, true);
  assert.equal(result.summary.configHintsPresent, true);
  assert.equal(result.summary.testHintsPresent, true);
  assert.equal(result.summary.setupUnclear, false);
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
      if (url.endsWith('/contents')) {
        return new Response(JSON.stringify([
          { type: 'file', name: 'README.md', path: 'README.md' },
          { type: 'file', name: 'CONTRIBUTING.md', path: 'CONTRIBUTING.md' },
          { type: 'file', name: 'package.json', path: 'package.json' },
          { type: 'dir', name: '.github', path: '.github' }
        ]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/package.json')) {
        return new Response(JSON.stringify(contentsResponse('package.json', { content: packageJson, size: packageJson.length })), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/.github')) {
        return new Response(JSON.stringify([{ type: 'dir', path: '.github/workflows', name: 'workflows' }]), { status: 200, headers: { 'content-type': 'application/json' } });
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

test('repo setup cache resolver reads storage once for repeated visible-result lookups', async () => {
  const {
    createCachedRepoSetupEnrichmentResolver,
    saveRepoSetupEnrichment
  } = await import('../src/api/repoSetup.js');
  const storage = createCountingLocalStorage();
  const first = issue({ number: 1, html_url: 'https://github.com/TEAMMATES/teammates/issues/1' });
  const second = issue({ number: 2, html_url: 'https://github.com/TEAMMATES/teammates/issues/2' });

  saveRepoSetupEnrichment(first, {
    inspected: true,
    setupDocsPresent: true,
    platformSupport: { linux: true },
    reasons: ['Linux setup supported']
  }, storage, { now: Date.parse('2026-05-23T12:00:00.000Z') });
  saveRepoSetupEnrichment(second, {
    inspected: true,
    setupDocsPresent: true,
    platformSupport: { windows: true },
    reasons: ['Windows setup supported']
  }, storage, { now: Date.parse('2026-05-23T12:00:00.000Z') });

  storage.resetCounts();
  const resolver = createCachedRepoSetupEnrichmentResolver(storage, {
    now: Date.parse('2026-05-23T13:00:00.000Z')
  });

  assert.equal(resolver(first).summary.platformSupport.linux, true);
  assert.equal(resolver(second).summary.platformSupport.windows, true);
  assert.equal(resolver(first).summary.platformSupport.linux, true);
  assert.equal(storage.getItemCalls, 1);
});

test('repo setup summary stays cautious when setup files are missing', async () => {
  const { fetchRepoSetupEnrichment } = await import('../src/api/repoSetup.js');

  const result = await fetchRepoSetupEnrichment(issue(), {
    storage: createLocalStorage(),
    fetchImpl: async (url) => new Response(JSON.stringify(url.endsWith('/contents') ? [] : { message: 'Not Found' }), {
      status: url.endsWith('/contents') ? 200 : 404,
      headers: { 'content-type': 'application/json' }
    })
  });

  assert.equal(result.summary.inspected, true);
  assert.equal(result.summary.setupDocsPresent, false);
  assert.equal(result.summary.workflowPresent, false);
  assert.equal(result.summary.setupUnclear, true);
  assert.deepEqual(result.summary.reasons, ['Setup files look unclear']);
});

test('repo setup enrichment detects compact platform compatibility without caching raw docs', async () => {
  const { SCORE_ENRICHMENT_CACHE_KEY } = await import('../src/api/issueComments.js');
  const { fetchRepoSetupEnrichment } = await import('../src/api/repoSetup.js');
  const storage = createLocalStorage();
  const contributing = Buffer.from([
    '# Contributing',
    'This project supports Linux and macOS development.',
    'Windows is not supported. Use Ubuntu or WSL for local setup.'
  ].join('\n')).toString('base64');

  const result = await fetchRepoSetupEnrichment(issue(), {
    storage,
    fetchImpl: async (url) => {
      if (url.endsWith('/contents')) {
        return new Response(JSON.stringify([
          { type: 'file', name: 'CONTRIBUTING.md', path: 'CONTRIBUTING.md' }
        ]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/contents/CONTRIBUTING.md')) {
        return new Response(JSON.stringify(contentsResponse('CONTRIBUTING.md', { content: contributing, size: contributing.length })), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`unexpected setup request: ${url}`);
    }
  });

  assert.equal(result.summary.platformSupport.linux, true);
  assert.equal(result.summary.platformSupport.macos, true);
  assert.equal(result.summary.platformUnsupported.windows, true);
  assert.match(result.summary.reasons.join(' '), /Linux|macOS|Windows/i);
  assert.doesNotMatch(storage.getItem(SCORE_ENRICHMENT_CACHE_KEY), /This project supports|Use Ubuntu|WSL for local setup/i);
});
