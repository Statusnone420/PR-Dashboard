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

function resetStorage() {
  storage.clear();
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

function filters() {
  return {
    languages: [],
    labels: [],
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false,
    unassigned: false,
    useFiltersInLookup: false
  };
}

test('response headers normalize into the fallback rate-limit bucket', async () => {
  const { rateLimitFromResponse } = await import('../src/api/github.js');

  const bucket = rateLimitFromResponse(response({}, {
    headers: {
      'x-ratelimit-remaining': '18',
      'x-ratelimit-limit': '30',
      'x-ratelimit-used': '12',
      'x-ratelimit-reset': '1770000000'
    }
  }), 'search', { now: '2026-05-23T12:00:00.000Z' });

  assert.deepEqual(bucket, {
    resource: 'search',
    remaining: 18,
    limit: 30,
    used: 12,
    reset: 1770000000,
    updatedAt: '2026-05-23T12:00:00.000Z'
  });
});

test('rate-limit status payload normalizes core and search resources', async () => {
  const { normalizeRateLimitStatusPayload } = await import('../src/api/github.js');

  const snapshot = normalizeRateLimitStatusPayload({
    resources: {
      core: { limit: 5000, remaining: 4978, used: 22, reset: 1770000000 },
      search: { limit: 30, remaining: 18, used: 12, reset: 1770000300 }
    }
  }, { now: '2026-05-23T12:05:00.000Z' });

  assert.equal(snapshot.lastCheckedAt, '2026-05-23T12:05:00.000Z');
  assert.deepEqual(snapshot.core, {
    resource: 'core',
    limit: 5000,
    remaining: 4978,
    used: 22,
    reset: 1770000000,
    updatedAt: '2026-05-23T12:05:00.000Z'
  });
  assert.deepEqual(snapshot.search, {
    resource: 'search',
    limit: 30,
    remaining: 18,
    used: 12,
    reset: 1770000300,
    updatedAt: '2026-05-23T12:05:00.000Z'
  });
});

test('search requests update the search rate-limit bucket', async () => {
  resetStorage();
  const { store } = await import('../src/state/store.js');
  const { searchGitHubIssues } = await import('../src/api/github.js');
  store.resetRateLimits();

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ items: [] }, {
    headers: {
      'x-ratelimit-resource': 'search',
      'x-ratelimit-remaining': '17',
      'x-ratelimit-limit': '30',
      'x-ratelimit-used': '13',
      'x-ratelimit-reset': '1770000300'
    }
  });

  try {
    await searchGitHubIssues('rate-limit-search-bucket', true, { filters: filters() });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(store.rateLimits.search.remaining, 17);
  assert.equal(store.rateLimits.search.limit, 30);
  assert.equal(store.rateLimits.search.used, 13);
  assert.equal(store.rateLimits.lastResource, 'search');
  assert.equal(store.rateLimit.resource, 'search');
});

test('cached search replay restores search bucket without manual-check status', async () => {
  resetStorage();
  const { store } = await import('../src/state/store.js');
  const { searchGitHubIssues } = await import('../src/api/github.js');
  store.resetRateLimits();

  let fetchCount = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return response({ items: [] }, {
      headers: {
        'x-ratelimit-resource': 'search',
        'x-ratelimit-remaining': '21',
        'x-ratelimit-limit': '30',
        'x-ratelimit-used': '9',
        'x-ratelimit-reset': '1770000300'
      }
    });
  };

  try {
    await searchGitHubIssues('rate-limit-cached-replay', true, { filters: filters() });
    store.resetRateLimits();
    await searchGitHubIssues('rate-limit-cached-replay', false, { filters: filters() });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(fetchCount, 1);
  assert.equal(store.rateLimits.search.remaining, 21);
  assert.equal(store.rateLimits.status, 'idle');
  assert.equal(store.rateLimits.lastCheckedAt, null);
});

test('lookup, refresh, and token test update the core rate-limit bucket', async () => {
  resetStorage();
  const { store } = await import('../src/state/store.js');
  const {
    fetchExactIssue,
    fetchGitHubUserForToken,
    fetchIssueMetadataForRefresh
  } = await import('../src/api/github.js');
  store.resetRateLimits();

  await fetchExactIssue({ owner: 'openai', repo: 'codex', number: 42 }, {
    fetchImpl: async () => response({
      id: 42,
      number: 42,
      title: 'Exact lookup issue',
      html_url: 'https://github.com/openai/codex/issues/42'
    }, {
      headers: {
        'x-ratelimit-remaining': '4998',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-used': '2',
        'x-ratelimit-reset': '1770000000'
      }
    })
  });
  assert.equal(store.rateLimits.core.remaining, 4998);

  await fetchIssueMetadataForRefresh({
    id: 43,
    number: 43,
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/43'
  }, {
    fetchImpl: async () => response({
      id: 43,
      number: 43,
      title: 'Refresh issue',
      html_url: 'https://github.com/openai/codex/issues/43'
    }, {
      headers: {
        'x-ratelimit-resource': 'core',
        'x-ratelimit-remaining': '4997',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-used': '3',
        'x-ratelimit-reset': '1770000000'
      }
    })
  });
  assert.equal(store.rateLimits.core.remaining, 4997);

  const user = await fetchGitHubUserForToken('sample-token', {
    fetchImpl: async () => response({ login: 'hardening-check' }, {
      headers: {
        'x-ratelimit-remaining': '4996',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-used': '4',
        'x-ratelimit-reset': '1770000000'
      }
    })
  });

  assert.equal(user.login, 'hardening-check');
  assert.equal(store.rateLimits.core.remaining, 4996);
  assert.equal(store.rateLimits.lastResource, 'core');
});

test('fetchGitHubRateLimitStatus returns normalized snapshot without mutating store', async () => {
  resetStorage();
  const { store } = await import('../src/state/store.js');
  const { fetchGitHubRateLimitStatus } = await import('../src/api/github.js');
  store.resetRateLimits();

  const snapshot = await fetchGitHubRateLimitStatus({
    token: 'sample-token',
    now: '2026-05-23T12:10:00.000Z',
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.github.com/rate_limit');
      assert.equal(init.headers.Authorization, 'Bearer sample-token');
      return response({
        resources: {
          core: { limit: 5000, remaining: 4990, used: 10, reset: 1770000000 },
          search: { limit: 30, remaining: 29, used: 1, reset: 1770000300 }
        }
      });
    }
  });

  assert.equal(snapshot.core.remaining, 4990);
  assert.equal(snapshot.search.remaining, 29);
  assert.equal(store.rateLimits.core.remaining, null);
  assert.equal(store.rateLimits.search.remaining, null);
});

test('token save, change, and clear reset rate-limit state without new storage keys', async () => {
  resetStorage();
  const { AppStore } = await import('../src/state/store.js');
  const appStore = new AppStore();

  appStore.setRateLimit({
    resource: 'search',
    remaining: 1,
    limit: 30,
    used: 29,
    reset: 1770000300,
    updatedAt: '2026-05-23T12:00:00.000Z'
  }, 'search');

  appStore.updateToken('first-token', false);
  assert.equal(appStore.rateLimits.search.remaining, null);
  assert.deepEqual([...storage.keys()].sort(), ['pr_dashboard_remember_token']);

  appStore.setRateLimit({
    resource: 'core',
    remaining: 4999,
    limit: 5000,
    used: 1,
    reset: 1770000000,
    updatedAt: '2026-05-23T12:00:00.000Z'
  }, 'core');
  appStore.updateToken('second-token', true);
  assert.equal(appStore.rateLimits.core.remaining, null);
  assert.deepEqual([...storage.keys()].sort(), ['pr_dashboard_remember_token', 'pr_dashboard_token']);

  appStore.setRateLimit({
    resource: 'search',
    remaining: 2,
    limit: 30,
    used: 28,
    reset: 1770000300,
    updatedAt: '2026-05-23T12:00:00.000Z'
  }, 'search');
  appStore.clearToken();
  assert.equal(appStore.rateLimits.search.remaining, null);
  assert.deepEqual([...storage.keys()].sort(), []);
});
