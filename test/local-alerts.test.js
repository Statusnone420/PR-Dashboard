import test from 'node:test';
import assert from 'node:assert/strict';

test('local alerts are derived from local board workflow timestamps', async () => {
  const { buildLocalAlerts } = await import('../src/localAlerts.js');

  const alerts = buildLocalAlerts({
    'Asked Maintainer': [{
      id: 1,
      title: 'Waiting for maintainer',
      column_entered_at: '2026-05-15T12:00:00.000Z',
      repository: { full_name: 'owner/repo' },
      number: 1
    }],
    'PR Open': [{
      id: 2,
      title: 'Review pending',
      column_entered_at: '2026-05-16T12:00:00.000Z',
      repository: { full_name: 'owner/repo' },
      number: 2,
      last_refreshed_at: '2026-05-16T12:00:00.000Z'
    }],
    Working: [{
      id: 3,
      title: 'Closed while active',
      state: 'closed',
      column_entered_at: '2026-05-21T12:00:00.000Z',
      repository: { full_name: 'owner/repo' },
      number: 3
    }]
  }, { now: '2026-05-22T12:00:00.000Z' });

  assert.deepEqual(alerts.map(alert => alert.kind), [
    'maintainer-follow-up',
    'pr-follow-up',
    'closed-active-card',
    'stale-refresh'
  ]);
});

test('GitHub activity reminders rank above stale refresh reminders', async () => {
  const { buildLocalAlerts } = await import('../src/localAlerts.js');

  const alerts = buildLocalAlerts({
    Working: [{
      id: 13997,
      title: 'Changed issue',
      repository: { full_name: 'TEAMMATES/teammates' },
      number: 13997,
      saved_at: '2026-05-15T12:00:00.000Z',
      last_refreshed_at: '2026-05-15T12:00:00.000Z',
      github_activity: {
        has_new_activity: true,
        summary: '2 new comments since last refresh.'
      }
    }]
  }, { now: '2026-05-22T12:00:00.000Z' });

  assert.deepEqual(alerts.map(alert => alert.kind), [
    'github-activity',
    'stale-refresh'
  ]);
  assert.equal(alerts[0].title, 'New GitHub activity');
  assert.equal(alerts[0].message, 'TEAMMATES/teammates#13997 has 2 new comments since last refresh.');
});
