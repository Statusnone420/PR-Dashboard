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
    labels: [{ name: 'good first issue' }, { name: 'bug' }],
    repository: {
      full_name: 'TEAMMATES/teammates',
      private: false,
      visibility: 'public'
    },
    ...overrides
  };
}

test('repo history URLs use small read-only GitHub API samples', async () => {
  const { buildRecentPullRequestsApiUrl, buildSameLabelIssueSearchApiUrl } = await import('../src/api/repoHistory.js');

  assert.equal(
    buildRecentPullRequestsApiUrl(issue()),
    'https://api.github.com/repos/TEAMMATES/teammates/pulls?state=closed&sort=updated&direction=desc&per_page=5'
  );
  assert.equal(
    buildSameLabelIssueSearchApiUrl(issue()),
    'https://api.github.com/search/issues?q=repo%3ATEAMMATES%2Fteammates%20is%3Aissue%20label%3A%22good%20first%20issue%22&sort=updated&order=desc&per_page=6'
  );
});

test('repo history summary detects recent merged PRs and active same-label issues', async () => {
  const { summarizeRepoHistory } = await import('../src/api/repoHistory.js');

  const summary = summarizeRepoHistory({
    pullRequests: [
      { merged_at: '2026-05-22T12:00:00.000Z', updated_at: '2026-05-22T12:00:00.000Z' },
      { merged_at: null, updated_at: '2026-05-21T12:00:00.000Z' }
    ],
    sameLabelIssues: {
      total_count: 2,
      items: [
        { state: 'open', updated_at: '2026-05-22T12:00:00.000Z' },
        { state: 'open', updated_at: '2026-05-20T12:00:00.000Z' }
      ]
    },
    now: Date.parse('2026-05-23T12:00:00.000Z')
  });

  assert.equal(summary.recentMergedPrs, true);
  assert.equal(summary.activeSameLabelIssues, true);
  assert.equal(summary.staleSameLabelSample, false);
  assert.deepEqual(summary.reasons, [
    'Recent repo PRs are merging',
    'Same-label issues are active'
  ]);
});

test('fetchRepoHistoryEnrichment caches compact PR and label samples', async () => {
  const { SCORE_ENRICHMENT_CACHE_KEY } = await import('../src/api/issueComments.js');
  const { fetchRepoHistoryEnrichment, getCachedRepoHistoryEnrichment } = await import('../src/api/repoHistory.js');
  const storage = createLocalStorage();
  const requests = [];

  const result = await fetchRepoHistoryEnrichment(issue(), {
    token: 'sample-token',
    now: Date.parse('2026-05-23T12:00:00.000Z'),
    storage,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (url.includes('/pulls?')) {
        return new Response(JSON.stringify([
          { title: 'Do not persist title', merged_at: '2026-05-22T12:00:00.000Z', updated_at: '2026-05-22T12:00:00.000Z' }
        ]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        total_count: 1,
        items: [{ title: 'Do not persist issue title', state: 'open', updated_at: '2026-05-22T12:00:00.000Z' }]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });

  assert.equal(requests.length, 2);
  assert.equal(requests.every(request => request.init.method === 'GET'), true);
  assert.equal(requests.every(request => request.init.headers.Authorization === 'Bearer sample-token'), true);
  assert.equal(result.summary.recentMergedPrs, true);
  assert.equal(result.summary.activeSameLabelIssues, true);
  assert.equal(getCachedRepoHistoryEnrichment(issue(), storage, { now: Date.parse('2026-05-23T13:00:00.000Z') }).summary.recentMergedPrs, true);
  const cachedResult = await fetchRepoHistoryEnrichment(issue(), {
    now: Date.parse('2026-05-23T13:00:00.000Z'),
    storage,
    fetchImpl: async () => {
      throw new Error('cache hit should not fetch');
    }
  });
  assert.equal(cachedResult.fromCache, true);
  assert.equal(cachedResult.rateLimit, null);
  assert.equal(cachedResult.rateLimits, null);
  assert.doesNotMatch(storage.getItem(SCORE_ENRICHMENT_CACHE_KEY), /Do not persist|sample-token|Authorization|Bearer/i);
});

test('repo history returns both core and search rate-limit buckets', async () => {
  const { fetchRepoHistoryEnrichment } = await import('../src/api/repoHistory.js');

  const result = await fetchRepoHistoryEnrichment(issue(), {
    now: Date.parse('2026-05-23T12:00:00.000Z'),
    storage: createLocalStorage(),
    fetchImpl: async (url) => {
      if (url.includes('/pulls?')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-ratelimit-resource': 'core',
            'x-ratelimit-remaining': '4996',
            'x-ratelimit-limit': '5000'
          }
        });
      }
      return new Response(JSON.stringify({ total_count: 0, items: [] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-resource': 'search',
          'x-ratelimit-remaining': '27',
          'x-ratelimit-limit': '30'
        }
      });
    }
  });

  assert.equal(result.rateLimit.resource, 'search');
  assert.equal(result.rateLimit.remaining, 27);
  assert.equal(result.rateLimits.core.resource, 'core');
  assert.equal(result.rateLimits.core.remaining, 4996);
  assert.equal(result.rateLimits.search.resource, 'search');
  assert.equal(result.rateLimits.search.remaining, 27);
  assert.equal(result.rateLimits.lastResource, 'search');
});

test('repo history excludes current issue from same-label activity sample', async () => {
  const { fetchRepoHistoryEnrichment } = await import('../src/api/repoHistory.js');
  const storage = createLocalStorage();

  const result = await fetchRepoHistoryEnrichment(issue(), {
    now: Date.parse('2026-05-23T12:00:00.000Z'),
    storage,
    fetchImpl: async (url) => {
      if (url.includes('/pulls?')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        total_count: 2,
        items: [
          {
            number: 13997,
            html_url: 'https://github.com/TEAMMATES/teammates/issues/13997',
            state: 'open',
            updated_at: '2026-05-22T12:00:00.000Z'
          },
          {
            number: 13996,
            html_url: 'https://github.com/TEAMMATES/teammates/issues/13996',
            state: 'open',
            updated_at: '2025-01-01T12:00:00.000Z'
          }
        ]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });

  assert.equal(result.summary.sampledSameLabelIssues, 1);
  assert.equal(result.summary.activeSameLabelIssues, false);
  assert.equal(result.summary.staleSameLabelSample, true);
  assert.deepEqual(result.summary.reasons, ['Same-label issues look stale']);
});
