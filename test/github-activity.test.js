import test from 'node:test';
import assert from 'node:assert/strict';

const NOW = '2026-05-22T16:00:00.000Z';

function card(overrides = {}) {
  return {
    id: 13997,
    number: 13997,
    title: 'Saved issue',
    updated_at: '2026-05-21T10:00:00.000Z',
    comments: 1,
    state: 'open',
    state_reason: null,
    closed_at: null,
    assignee: { login: 'alice' },
    assignees: [{ login: 'alice' }],
    labels: [{ name: 'bug' }],
    repository: { full_name: 'TEAMMATES/teammates' },
    ...overrides
  };
}

function issue(overrides = {}) {
  return {
    id: 13997,
    number: 13997,
    title: 'Saved issue',
    updated_at: '2026-05-21T10:00:00.000Z',
    comments: 1,
    state: 'open',
    state_reason: null,
    closed_at: null,
    assignee: { login: 'alice' },
    assignees: [{ login: 'alice' }],
    labels: [{ name: 'bug' }],
    repository: { full_name: 'TEAMMATES/teammates' },
    ...overrides
  };
}

test('comment increases create GitHub activity summaries', async () => {
  const { buildGitHubActivity } = await import('../src/githubActivity.js');

  const activity = buildGitHubActivity(card(), issue({
    comments: 3,
    updated_at: '2026-05-22T15:00:00.000Z'
  }), { now: NOW, etag: '"new-etag"' });

  assert.equal(activity.has_new_activity, true);
  assert.equal(activity.previous_comments, 1);
  assert.equal(activity.latest_comments, 3);
  assert.equal(activity.comment_delta, 2);
  assert.equal(activity.summary, '2 new comments since last refresh.');
  assert.equal(activity.etag, '"new-etag"');
});

test('comment decreases update metadata without creating activity', async () => {
  const { buildGitHubActivity } = await import('../src/githubActivity.js');

  const activity = buildGitHubActivity(card({
    comments: 5,
    updated_at: '2026-05-21T10:00:00.000Z',
    github_activity: {
      has_new_activity: true,
      summary: '4 new comments since last refresh.',
      comment_delta: 4,
      labels_changed: true
    }
  }), issue({
    comments: 4,
    updated_at: '2026-05-22T15:00:00.000Z'
  }), { now: NOW });

  assert.equal(activity.has_new_activity, false);
  assert.equal(activity.previous_comments, 5);
  assert.equal(activity.latest_comments, 4);
  assert.equal(activity.comment_delta, -1);
  assert.equal(activity.labels_changed, false);
  assert.equal(activity.summary, 'No changes since last refresh.');
});

test('state changes and closed dates outrank comment activity', async () => {
  const { buildGitHubActivity } = await import('../src/githubActivity.js');

  const activity = buildGitHubActivity(card(), issue({
    comments: 4,
    state: 'closed',
    state_reason: 'completed',
    closed_at: '2026-05-22T15:00:00.000Z',
    updated_at: '2026-05-22T15:00:00.000Z'
  }), { now: NOW });

  assert.equal(activity.has_new_activity, true);
  assert.equal(activity.state_changed, true);
  assert.equal(activity.closed_changed, true);
  assert.equal(activity.summary, 'Issue was closed on GitHub.');
});

test('assignee, assignees, labels, state reason, and updated_at changes are detected', async () => {
  const { buildGitHubActivity } = await import('../src/githubActivity.js');

  const activity = buildGitHubActivity(card(), issue({
    updated_at: '2026-05-22T15:00:00.000Z',
    state_reason: 'reopened',
    assignee: { login: 'bob' },
    assignees: [{ login: 'bob' }, { login: 'carol' }],
    labels: [{ name: 'bug' }, { name: 'help wanted' }]
  }), { now: NOW });

  assert.equal(activity.has_new_activity, true);
  assert.equal(activity.state_reason_changed, true);
  assert.equal(activity.assignee_changed, true);
  assert.equal(activity.assignees_changed, true);
  assert.equal(activity.labels_changed, true);
  assert.equal(activity.updated_changed, true);
  assert.equal(activity.summary, 'Assignee changed on GitHub.');
});

test('updated_at-only changes create a low-priority activity summary', async () => {
  const { buildGitHubActivity } = await import('../src/githubActivity.js');

  const activity = buildGitHubActivity(card(), issue({
    updated_at: '2026-05-22T15:00:00.000Z'
  }), { now: NOW });

  assert.equal(activity.has_new_activity, true);
  assert.equal(activity.summary, 'Updated on GitHub since last refresh.');
});

test('no-change and 304 activity cleanup clears stale reminder copy', async () => {
  const { buildGitHubActivity, buildUnchangedGitHubActivity } = await import('../src/githubActivity.js');
  const staleCard = card({
    github_activity: {
      has_new_activity: true,
      summary: '2 new comments since last refresh.',
      comment_delta: 2,
      assignee_changed: true,
      etag: '"old-etag"'
    }
  });

  const noChange = buildGitHubActivity(staleCard, issue(), { now: NOW, etag: '"new-etag"' });
  const notModified = buildUnchangedGitHubActivity(staleCard, { now: NOW });

  for (const activity of [noChange, notModified]) {
    assert.equal(activity.has_new_activity, false);
    assert.equal(activity.summary, 'No changes since last refresh.');
    assert.equal(activity.comment_delta, 0);
    assert.equal(activity.assignee_changed, false);
    assert.equal(activity.last_checked_at, NOW);
  }
  assert.equal(noChange.etag, '"new-etag"');
  assert.equal(notModified.etag, '"old-etag"');
});
