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

test('issue timeline API URL is read-only and built from a valid issue reference', async () => {
  const { buildIssueTimelineApiUrl } = await import('../src/api/issueTimeline.js');

  assert.equal(
    buildIssueTimelineApiUrl(issue()),
    'https://api.github.com/repos/TEAMMATES/teammates/issues/13997/timeline?per_page=100'
  );
  assert.throws(() => buildIssueTimelineApiUrl({
    number: 1,
    html_url: 'https://evil.example/owner/repo/issues/1',
    repository: { full_name: 'owner/repo' }
  }), /valid GitHub issue/);
});

test('timeline summary treats pull-request references as strong claimed-work evidence', async () => {
  const { summarizeIssueTimeline } = await import('../src/api/issueTimeline.js');

  const summary = summarizeIssueTimeline([
    {
      event: 'cross-referenced',
      source: {
        type: 'issue',
        issue: {
          html_url: 'https://github.com/TEAMMATES/teammates/pull/14000',
          pull_request: { url: 'https://api.github.com/repos/TEAMMATES/teammates/pulls/14000' }
        }
      }
    },
    { event: 'assigned', assignee: { login: 'contributor' } },
    { event: 'renamed', rename: { from: 'old title', to: 'new title' } },
    { event: 'closed' }
  ]);

  assert.equal(summary.inspected, true);
  assert.equal(summary.linkedPullRequest, true);
  assert.equal(summary.assignmentActivity, true);
  assert.equal(summary.closedOrReopened, true);
  assert.deepEqual(summary.reasons, [
    'Timeline shows linked PR activity',
    'Timeline shows assignment activity',
    'Timeline includes close/reopen context',
    'Issue title changed during discussion'
  ]);
});

test('timeline summary does not over-penalize weak non-PR references', async () => {
  const { summarizeIssueTimeline } = await import('../src/api/issueTimeline.js');

  const summary = summarizeIssueTimeline([
    {
      event: 'cross-referenced',
      source: {
        type: 'issue',
        issue: { html_url: 'https://github.com/TEAMMATES/teammates/issues/14000' }
      }
    }
  ]);

  assert.equal(summary.linkedPullRequest, false);
  assert.equal(summary.assignmentActivity, false);
  assert.deepEqual(summary.reasons, ['Timeline inspected without strong claim signals']);
});

test('fetchIssueTimelineEnrichment sends one GET and stores compact timeline summary', async () => {
  const { SCORE_ENRICHMENT_CACHE_KEY } = await import('../src/api/issueComments.js');
  const { fetchIssueTimelineEnrichment, getCachedIssueTimelineEnrichment } = await import('../src/api/issueTimeline.js');
  const storage = createLocalStorage();
  const requests = [];

  const result = await fetchIssueTimelineEnrichment(issue(), {
    token: 'sample-token',
    now: Date.parse('2026-05-23T12:00:00.000Z'),
    storage,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify([
        {
          event: 'cross-referenced',
          source: {
            issue: {
              pull_request: { url: 'https://api.github.com/repos/TEAMMATES/teammates/pulls/14000' }
            }
          },
          body: 'do not persist'
        }
      ]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-resource': 'core',
          'x-ratelimit-remaining': '4998',
          'x-ratelimit-limit': '5000'
        }
      });
    }
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer sample-token');
  assert.equal(result.summary.linkedPullRequest, true);
  assert.equal(result.rateLimit.remaining, 4998);
  assert.equal(getCachedIssueTimelineEnrichment(issue(), storage, { now: Date.parse('2026-05-23T13:00:00.000Z') }).summary.linkedPullRequest, true);
  assert.doesNotMatch(storage.getItem(SCORE_ENRICHMENT_CACHE_KEY), /do not persist|sample-token|Authorization|Bearer/i);
});

test('fetchIssueTimelineEnrichment follows pagination for later timeline signals', async () => {
  const { fetchIssueTimelineEnrichment } = await import('../src/api/issueTimeline.js');
  const requests = [];

  const result = await fetchIssueTimelineEnrichment(issue(), {
    now: Date.parse('2026-05-23T12:00:00.000Z'),
    storage: createLocalStorage(),
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (url.includes('page=2')) {
        return new Response(JSON.stringify([
          {
            event: 'cross-referenced',
            source: {
              issue: {
                pull_request: { url: 'https://api.github.com/repos/TEAMMATES/teammates/pulls/14000' }
              }
            },
            body: 'do not persist'
          },
          { event: 'assigned', assignee: { login: 'contributor' } }
        ]), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-ratelimit-resource': 'core',
            'x-ratelimit-remaining': '4996'
          }
        });
      }
      return new Response(JSON.stringify([{ event: 'renamed', rename: { from: 'old', to: 'new' } }]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          link: '<https://api.github.com/repos/TEAMMATES/teammates/issues/13997/timeline?per_page=100&page=2>; rel="next"',
          'x-ratelimit-resource': 'core',
          'x-ratelimit-remaining': '4997'
        }
      });
    }
  });

  assert.equal(requests.length, 2);
  assert.equal(result.summary.totalEvents, 3);
  assert.equal(result.summary.linkedPullRequest, true);
  assert.equal(result.summary.assignmentActivity, true);
  assert.equal(result.summary.renamed, true);
  assert.equal(result.rateLimit.remaining, 4996);
});
