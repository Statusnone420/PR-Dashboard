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

test('buildQueryString uses OR for selected beginner-friendly labels by default', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('parser', {
    languages: [],
    labels: ['good first issue', 'help wanted'],
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false
  });

  assert.match(query, /archived:false/);
  assert.match(query, /label:"good first issue","help wanted"/);
  assert.doesNotMatch(query, /label:"good first issue" label:"help wanted"/);
});

test('buildQueryString keeps difficulty as local fit intent instead of GitHub labels', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('config', {
    languages: [],
    labels: ['help wanted'],
    labelMode: 'OR',
    difficulty: 'Intermediate',
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false
  });

  assert.match(query, /label:"help wanted"/);
  assert.doesNotMatch(query, /label:"level:intermediate"/);
  assert.doesNotMatch(query, /label:"difficulty:intermediate"/);
  assert.doesNotMatch(query, /label:"intermediate"/);
});

test('buildQueryString does not add beginner label aliases when only Beginner difficulty is selected', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const beginnerQuery = buildQueryString('setup', {
    languages: [],
    labels: [],
    labelMode: 'OR',
    difficulty: 'Beginner',
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false
  });

  assert.match(beginnerQuery, /setup/);
  assert.doesNotMatch(beginnerQuery, /label:/);
  assert.doesNotMatch(beginnerQuery, /good first issue|level:beginner|difficulty:beginner|beginner/);
});

test('buildQueryString quotes languages with GitHub search punctuation', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('parser', {
    languages: ['C#', 'C++', 'Python'],
    labels: [],
    labelMode: 'OR',
    difficulty: 'Any',
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false
  });

  assert.match(query, /\(language:"C#" OR language:"C\+\+" OR language:Python\)/);
});

test('buildQueryString combines selected label chips as strict GitHub OR filters', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('', {
    languages: [],
    labels: ['bug', 'performance'],
    labelMode: 'AND',
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score'
  });

  assert.match(query, /label:"bug","performance"/);
  assert.doesNotMatch(query, /label:"bug" label:"performance"/);
});

test('buildQueryString keeps search open-only unless closed issues are explicitly included', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const openOnly = buildQueryString('docs', {
    languages: [],
    labels: [],
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false
  });
  const includeClosed = buildQueryString('docs', {
    languages: [],
    labels: [],
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: true
  });

  assert.match(openOnly, /state:open/);
  assert.match(openOnly, /archived:false/);
  assert.doesNotMatch(includeClosed, /state:open/);
});

test('buildQueryString adds no:assignee only when unassigned filter is active', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('docs', {
    languages: [],
    labels: [],
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false,
    unassigned: true
  });

  assert.match(query, /no:assignee/);
});

test('buildQueryString never sends stars qualifiers for issue search', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('parser', {
    languages: [],
    labels: [],
    stars: '10k+',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false
  });

  assert.doesNotMatch(query, /stars:>=/);
});

test('lookup mode is broad and literal until filters are explicitly enabled', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('openai/codex terminal bug', {
    languages: ['TypeScript'],
    labels: ['good first issue', 'help wanted'],
    labelMode: 'OR',
    stars: '1k+',
    comments: 'Low (0-5)',
    updatedDate: 'Last week',
    sortMode: 'Fit Score',
    includeClosed: false,
    useFiltersInLookup: false
  }, { mode: 'lookup' });

  assert.equal(query, 'is:issue openai/codex terminal bug');
});

test('lookup mode can explicitly apply normal filters', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('openai/codex terminal bug', {
    languages: [],
    labels: ['help wanted'],
    labelMode: 'OR',
    stars: 'Any',
    comments: 'Low (0-5)',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false,
    useFiltersInLookup: true
  }, { mode: 'lookup' });

  assert.match(query, /state:open/);
  assert.match(query, /label:"help wanted"/);
  assert.match(query, /comments:0\.\.5/);
});

test('query preview matches the q value sent to GitHub search', async () => {
  const { buildQueryPreview, buildSearchIssuesUrl } = await import('../src/api/github.js');
  const filters = {
    languages: ['TypeScript'],
    labels: ['good first issue', 'help wanted'],
    labelMode: 'OR',
    stars: '1k+',
    comments: 'Low (0-5)',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false
  };

  const preview = buildQueryPreview('parser', filters);
  const url = new URL(buildSearchIssuesUrl('parser', filters));

  assert.equal(preview, url.searchParams.get('q'));
});

test('target platform filters stay local and do not alter GitHub search qualifiers', async () => {
  const { buildQueryString } = await import('../src/api/github.js');

  const query = buildQueryString('setup', {
    languages: [],
    labels: [],
    labelMode: 'OR',
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false,
    targetPlatforms: ['windows', 'web']
  });

  assert.match(query, /setup/);
  assert.doesNotMatch(query, /windows|web|platform|os/i);
});

test('normalizeGitHubIssue extracts repository identity from repository_url', async () => {
  const { normalizeGitHubIssue } = await import('../src/api/github.js');

  const issue = normalizeGitHubIssue({
    id: 1,
    number: 2,
    title: 'Real issue',
    repository_url: 'https://api.github.com/repos/vuejs/core',
    html_url: 'https://github.com/vuejs/core/issues/2'
  });

  assert.equal(issue.repository.full_name, 'vuejs/core');
  assert.equal(issue.repository.name, 'core');
});

function response(body, options = {}) {
  const headers = new Map(Object.entries(options.headers || {
    'x-ratelimit-resource': options.resource || 'search',
    'x-ratelimit-remaining': '29',
    'x-ratelimit-limit': '30',
    'x-ratelimit-used': '1',
    'x-ratelimit-reset': '1770000300'
  }));
  return {
    ok: options.ok !== false,
    status: options.status || 200,
    headers: {
      get(key) {
        return headers.get(String(key).toLowerCase()) || headers.get(String(key)) || null;
      }
    },
    json: async () => body
  };
}

function filters(overrides = {}) {
  return {
    languages: [],
    labels: [],
    labelMode: 'OR',
    difficulty: 'Beginner',
    stars: '5k+',
    comments: 'Any',
    updatedDate: 'Any',
    sortMode: 'Fit Score',
    includeClosed: false,
    unassigned: false,
    targetPlatforms: ['web'],
    ...overrides
  };
}

function repoIssue(overrides = {}) {
  const owner = overrides.owner || 'owner';
  const repo = overrides.repo || 'high-stars';
  const number = overrides.number || 7;
  return {
    id: overrides.id || 700,
    number,
    title: overrides.title || 'Fix focused setup docs',
    body: overrides.body || 'Expected behavior: setup docs should include the missing command.\n\n- Add the command.\n- Update the docs.',
    state: 'open',
    labels: overrides.labels || [],
    assignee: null,
    assignees: [],
    comments: 1,
    created_at: '2026-05-20T12:00:00Z',
    updated_at: '2026-05-29T12:00:00Z',
    html_url: `https://github.com/${owner}/${repo}/issues/${number}`,
    repository_url: `https://api.github.com/repos/${owner}/${repo}`
  };
}

test('searchGitHubIssues can discover unlabeled beginner-fit issues from high-star repos', async () => {
  storage.clear();
  const { store } = await import('../src/state/store.js');
  const { searchGitHubIssues } = await import('../src/api/github.js');
  const previousFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    requests.push(String(url));
    const parsed = new URL(String(url));
    if (parsed.pathname === '/search/issues') {
      return response({ items: [] }, { resource: 'search' });
    }
    if (parsed.pathname === '/search/repositories') {
      return response({
        items: [{
          full_name: 'owner/high-stars',
          name: 'high-stars',
          stargazers_count: 6200,
          forks_count: 120,
          open_issues_count: 12,
          archived: false,
          disabled: false,
          default_branch: 'main',
          language: 'JavaScript',
          topics: ['cli']
        }]
      }, { resource: 'search' });
    }
    if (parsed.pathname === '/repos/owner/high-stars/issues') {
      return response([repoIssue()], { resource: 'core' });
    }
    if (parsed.pathname === '/repos/owner/high-stars') {
      return response({
        full_name: 'owner/high-stars',
        name: 'high-stars',
        stargazers_count: 6200,
        forks_count: 120,
        open_issues_count: 12,
        archived: false,
        disabled: false,
        default_branch: 'main',
        language: 'JavaScript',
        topics: ['cli']
      }, { resource: 'core' });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const results = await searchGitHubIssues('', true, { filters: filters(), mode: 'find' });
    assert.equal(results.length, 1);
    assert.equal(results[0].repository.full_name, 'owner/high-stars');
    assert.equal(results[0].repository.stargazers_count, 6200);
    assert.deepEqual(results[0].labels, []);
    assert.ok(requests.some(url => url.includes('/search/repositories')));
    assert.equal(store.lastSearchDiagnostics.visibleCount, null);
    assert.equal(store.lastSearchDiagnostics.fetchedCount, 1);
    assert.equal(store.lastSearchDiagnostics.hydratedCount, 1);
    assert.equal(store.lastSearchDiagnostics.hardFilteredCount, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('searchGitHubIssues keeps selected labels strict during repo discovery', async () => {
  storage.clear();
  const { searchGitHubIssues } = await import('../src/api/github.js');
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === '/search/issues') {
      return response({ items: [] }, { resource: 'search' });
    }
    if (parsed.pathname === '/search/repositories') {
      return response({
        items: [{
          full_name: 'owner/high-stars',
          name: 'high-stars',
          stargazers_count: 6200
        }]
      }, { resource: 'search' });
    }
    if (parsed.pathname === '/repos/owner/high-stars/issues') {
      return response([repoIssue()], { resource: 'core' });
    }
    if (parsed.pathname === '/repos/owner/high-stars') {
      return response({
        full_name: 'owner/high-stars',
        name: 'high-stars',
        stargazers_count: 6200
      }, { resource: 'core' });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const results = await searchGitHubIssues('', true, {
      filters: filters({ labels: ['help wanted'] }),
      mode: 'find'
    });
    assert.deepEqual(results, []);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('searchGitHubIssues deduplicates issues returned by multiple discovery sources', async () => {
  storage.clear();
  const { searchGitHubIssues } = await import('../src/api/github.js');
  const previousFetch = globalThis.fetch;
  const duplicate = repoIssue({ id: 900, number: 9 });

  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === '/search/issues') {
      return response({ items: [duplicate] }, { resource: 'search' });
    }
    if (parsed.pathname === '/search/repositories') {
      return response({
        items: [{
          full_name: 'owner/high-stars',
          name: 'high-stars',
          stargazers_count: 6200
        }]
      }, { resource: 'search' });
    }
    if (parsed.pathname === '/repos/owner/high-stars/issues') {
      return response([duplicate], { resource: 'core' });
    }
    if (parsed.pathname === '/repos/owner/high-stars') {
      return response({
        full_name: 'owner/high-stars',
        name: 'high-stars',
        stargazers_count: 6200
      }, { resource: 'core' });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const results = await searchGitHubIssues('', true, { filters: filters(), mode: 'find' });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 900);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
