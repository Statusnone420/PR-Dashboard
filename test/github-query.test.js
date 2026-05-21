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

test('buildQueryString supports explicit AND label behavior', async () => {
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

  assert.match(query, /label:"bug" label:"performance"/);
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
