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

test('issue comments API URL is read-only and built from a valid GitHub issue reference', async () => {
  const { buildIssueCommentsApiUrl } = await import('../src/api/issueComments.js');

  assert.equal(
    buildIssueCommentsApiUrl(issue()),
    'https://api.github.com/repos/TEAMMATES/teammates/issues/13997/comments?per_page=100'
  );
  assert.throws(() => buildIssueCommentsApiUrl({
    number: 1,
    html_url: 'https://evil.example/owner/repo/issues/1',
    repository: { full_name: 'owner/repo' }
  }), /valid GitHub issue/);
});

test('fetchIssueCommentsEnrichment sends GET with Authorization only to GitHub API', async () => {
  const { fetchIssueCommentsEnrichment } = await import('../src/api/issueComments.js');
  const requests = [];

  const result = await fetchIssueCommentsEnrichment(issue(), {
    token: 'sample-token',
    now: Date.parse('2026-05-23T12:00:00.000Z'),
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-resource': 'core',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-limit': '5000'
        }
      });
    },
    storage: createLocalStorage()
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer sample-token');
  assert.equal(requests[0].url.startsWith('https://api.github.com/'), true);
  assert.equal(result.summary.inspected, true);
  assert.equal(result.rateLimit.resource, 'core');
});

test('fetchIssueCommentsEnrichment follows pagination for newer comment signals', async () => {
  const { fetchIssueCommentsEnrichment } = await import('../src/api/issueComments.js');
  const requests = [];

  const result = await fetchIssueCommentsEnrichment(issue(), {
    now: Date.parse('2026-05-23T12:00:00.000Z'),
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (url.includes('page=2')) {
        return new Response(JSON.stringify([
          {
            body: 'I am working on this, but it is blocked by setup work.',
            author_association: 'CONTRIBUTOR',
            user: { login: 'contributor', type: 'User' }
          }
        ]), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-ratelimit-resource': 'core',
            'x-ratelimit-remaining': '4997'
          }
        });
      }
      return new Response(JSON.stringify([
        {
          body: 'Initial discussion.',
          author_association: 'NONE',
          user: { login: 'reporter', type: 'User' }
        }
      ]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          link: '<https://api.github.com/repos/TEAMMATES/teammates/issues/13997/comments?per_page=100&page=2>; rel="next"',
          'x-ratelimit-resource': 'core',
          'x-ratelimit-remaining': '4998'
        }
      });
    },
    storage: createLocalStorage()
  });

  assert.equal(requests.length, 2);
  assert.equal(result.summary.totalComments, 2);
  assert.equal(result.summary.ownershipClaim, true);
  assert.equal(result.summary.blockedHint, true);
  assert.equal(result.rateLimit.remaining, 4997);
});

test('comment summary detects maintainer encouragement, ownership claims, and blocked hints', async () => {
  const { summarizeIssueComments } = await import('../src/api/issueComments.js');

  const summary = summarizeIssueComments([
    {
      body: 'PR welcome, happy to review.',
      author_association: 'MEMBER',
      user: { login: 'maintainer', type: 'User' }
    },
    {
      body: "I'll take this and opened a PR.",
      author_association: 'CONTRIBUTOR',
      user: { login: 'contributor', type: 'User' }
    },
    {
      body: 'This is blocked by the parser work and may be duplicate of #1.',
      author_association: 'NONE',
      user: { login: 'reporter', type: 'User' }
    }
  ]);

  assert.equal(summary.maintainerEncouragement, true);
  assert.equal(summary.ownershipClaim, true);
  assert.equal(summary.blockedHint, true);
  assert.equal(summary.botOnlyRecentActivity, false);
  assert.deepEqual(summary.reasons, [
    'Maintainer appears open to PRs',
    'Comment thread suggests someone may be working on this',
    'Comment thread suggests blocked work'
  ]);
});

test('bot-only recent activity does not count as maintainer encouragement', async () => {
  const { summarizeIssueComments } = await import('../src/api/issueComments.js');

  const summary = summarizeIssueComments([
    {
      body: 'PR welcome',
      author_association: 'MEMBER',
      user: { login: 'github-actions[bot]', type: 'Bot' }
    }
  ]);

  assert.equal(summary.botOnlyRecentActivity, true);
  assert.equal(summary.maintainerEncouragement, false);
  assert.deepEqual(summary.reasons, ['Only bot comments inspected']);
});

test('enrichment cache honors TTL and stores compact public comment summaries only', async () => {
  const storage = createLocalStorage();
  const {
    SCORE_ENRICHMENT_CACHE_KEY,
    getCachedIssueCommentEnrichment,
    saveIssueCommentEnrichment
  } = await import('../src/api/issueComments.js');

  const summary = {
    inspected: true,
    totalComments: 1,
    maintainerEncouragement: true,
    ownershipClaim: false,
    blockedHint: false,
    botOnlyRecentActivity: false,
    reasons: ['Maintainer appears open to PRs'],
    body: 'do not persist',
    token: 'secret-token'
  };

  saveIssueCommentEnrichment(issue(), summary, storage, { now: Date.parse('2026-05-23T12:00:00.000Z'), tokenUsed: false });
  assert.equal(
    getCachedIssueCommentEnrichment(issue(), storage, { now: Date.parse('2026-05-23T13:00:00.000Z') }).summary.maintainerEncouragement,
    true
  );
  assert.equal(
    getCachedIssueCommentEnrichment(issue(), storage, { now: Date.parse('2026-05-23T19:01:00.000Z') }),
    null
  );
  assert.doesNotMatch(storage.getItem(SCORE_ENRICHMENT_CACHE_KEY), /do not persist|secret-token|Authorization|Bearer/i);
});

test('enrichment cache skips private repos and token-used unknown visibility repos', async () => {
  const storage = createLocalStorage();
  const {
    SCORE_ENRICHMENT_CACHE_KEY,
    saveIssueCommentEnrichment
  } = await import('../src/api/issueComments.js');
  const summary = { inspected: true, reasons: [] };

  saveIssueCommentEnrichment(issue({ repository: { full_name: 'owner/private', private: true } }), summary, storage, { tokenUsed: false });
  assert.equal(storage.getItem(SCORE_ENRICHMENT_CACHE_KEY), null);

  saveIssueCommentEnrichment(issue({ repository: { full_name: 'owner/unknown' } }), summary, storage, { tokenUsed: true });
  assert.equal(storage.getItem(SCORE_ENRICHMENT_CACHE_KEY), null);
});
