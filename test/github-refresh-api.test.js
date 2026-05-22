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

function response(body, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText || '',
    headers: new Headers(options.headers || {}),
    async json() {
      return body;
    }
  };
}

function savedCard(overrides = {}) {
  return {
    id: 1,
    number: 42,
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/42',
    github_activity: { etag: '"old-etag"' },
    ...overrides
  };
}

test('refresh issue metadata sends If-None-Match and returns ETag plus rate-limit headers', async () => {
  globalThis.localStorage = createLocalStorage();
  const { fetchIssueMetadataForRefresh } = await import('../src/api/github.js');
  let request;

  const result = await fetchIssueMetadataForRefresh(savedCard(), {
    token: 'sample-token',
    fetchImpl: async (url, init) => {
      request = { url, init };
      return response({
        id: 1,
        number: 42,
        repository_url: 'https://api.github.com/repos/openai/codex',
        html_url: 'https://github.com/openai/codex/issues/42'
      }, {
        headers: {
          etag: '"new-etag"',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-limit': '5000',
          'x-ratelimit-reset': '1770000000'
        }
      });
    }
  });

  assert.equal(request.url, 'https://api.github.com/repos/openai/codex/issues/42');
  assert.equal(request.init.headers.Authorization, 'Bearer sample-token');
  assert.equal(request.init.headers['If-None-Match'], '"old-etag"');
  assert.equal(result.notModified, false);
  assert.equal(result.etag, '"new-etag"');
  assert.deepEqual(result.rateLimit, { remaining: 4999, limit: 5000, reset: 1770000000 });
  assert.equal(result.issue.repository.full_name, 'openai/codex');
});

test('refresh issue metadata handles 304 without parsing a JSON body', async () => {
  globalThis.localStorage = createLocalStorage();
  const { fetchIssueMetadataForRefresh } = await import('../src/api/github.js');

  const result = await fetchIssueMetadataForRefresh(savedCard(), {
    fetchImpl: async () => ({
      ok: false,
      status: 304,
      headers: new Headers({
        etag: '"same-etag"',
        'x-ratelimit-remaining': '59',
        'x-ratelimit-limit': '60'
      }),
      async json() {
        throw new Error('json should not be read for 304');
      }
    })
  });

  assert.equal(result.notModified, true);
  assert.equal(result.issue, null);
  assert.equal(result.etag, '"same-etag"');
  assert.deepEqual(result.rateLimit, { remaining: 59, limit: 60, reset: null });
});

test('refresh issue metadata throws a structured rate-limit error for 403 and 429', async () => {
  globalThis.localStorage = createLocalStorage();
  const { fetchIssueMetadataForRefresh, GitHubRefreshRateLimitError } = await import('../src/api/github.js');

  await assert.rejects(
    () => fetchIssueMetadataForRefresh(savedCard(), {
      fetchImpl: async () => response({ message: 'API rate limit exceeded' }, {
        ok: false,
        status: 403,
        headers: {
          'retry-after': '60',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-limit': '60',
          'x-ratelimit-reset': '1770000000'
        }
      })
    }),
    (error) => {
      assert.equal(error instanceof GitHubRefreshRateLimitError, true);
      assert.equal(error.status, 403);
      assert.equal(error.retryAfter, 60);
      assert.deepEqual(error.rateLimit, { remaining: 0, limit: 60, reset: 1770000000 });
      assert.match(error.message, /rate limit/i);
      return true;
    }
  );
});
