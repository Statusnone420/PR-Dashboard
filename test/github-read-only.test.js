import test from 'node:test';
import assert from 'node:assert/strict';

test('paginated read-only GitHub fetch returns a single page without next link', async () => {
  const { fetchPaginatedReadOnlyGitHubJson } = await import('../src/api/githubReadOnly.js');
  const requests = [];

  const result = await fetchPaginatedReadOnlyGitHubJson('https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100', {
    token: 'sample-token',
    now: '2026-05-24T12:00:00.000Z',
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-resource': 'core',
          'x-ratelimit-remaining': '4999'
        }
      });
    }
  });

  assert.deepEqual(result.items, [{ id: 1 }]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer sample-token');
  assert.equal(result.rateLimit.remaining, 4999);
});

test('paginated read-only GitHub fetch follows rel next and returns the final rate limit', async () => {
  const { fetchPaginatedReadOnlyGitHubJson } = await import('../src/api/githubReadOnly.js');
  const requests = [];

  const result = await fetchPaginatedReadOnlyGitHubJson('https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100', {
    now: '2026-05-24T12:00:00.000Z',
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (url.includes('page=2')) {
        return new Response(JSON.stringify([{ id: 2 }]), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-ratelimit-resource': 'core',
            'x-ratelimit-remaining': '4998'
          }
        });
      }
      return new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          link: '<https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100&page=2>; rel="next", <https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100&page=2>; rel="last"',
          'x-ratelimit-resource': 'core',
          'x-ratelimit-remaining': '4999'
        }
      });
    }
  });

  assert.deepEqual(result.items, [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(requests.map(request => request.url), [
    'https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100',
    'https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100&page=2'
  ]);
  assert.equal(result.rateLimit.remaining, 4998);
});

test('paginated read-only GitHub fetch blocks non-GitHub next links', async () => {
  const { fetchPaginatedReadOnlyGitHubJson } = await import('../src/api/githubReadOnly.js');

  await assert.rejects(
    () => fetchPaginatedReadOnlyGitHubJson('https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100', {
      fetchImpl: async () => new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          link: '<https://evil.example/repos/owner/repo/issues/1/comments?page=2>; rel="next"'
        }
      })
    }),
    /only https:\/\/api\.github\.com/
  );
});
