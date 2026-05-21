import test from 'node:test';
import assert from 'node:assert/strict';

test('issue API metadata updates GitHub fields while preserving local board state', async () => {
  const { mergeIssueMetadata } = await import('../src/boardModel.js');

  const savedCard = {
    id: 8291,
    number: 8291,
    title: 'Fake seeded title',
    column: 'Working',
    progress: 65,
    checklist: [{ text: 'Local task', completed: true }],
    repository: { full_name: 'vuejs/core', name: 'core' },
    html_url: 'https://github.com/vuejs/core/issues/8291',
    state: 'open'
  };
  const apiIssue = {
    id: 8291,
    number: 8291,
    title: 'SFC generate wrong code when use onUpdate:value as defineProps key',
    state: 'closed',
    state_reason: 'completed',
    updated_at: '2023-09-10T00:19:35Z',
    closed_at: '2023-05-12T10:25:01Z',
    labels: [{ name: 'scope: sfc' }],
    assignees: [{ login: 'yyx990803' }],
    comments: 3,
    html_url: 'https://github.com/vuejs/core/issues/8291',
    body: '<b>not rendered as HTML</b>',
    repository: { full_name: 'vuejs/core', name: 'core' }
  };

  const merged = mergeIssueMetadata(savedCard, apiIssue);

  assert.equal(merged.title, apiIssue.title);
  assert.equal(merged.state, 'closed');
  assert.equal(merged.state_reason, 'completed');
  assert.equal(merged.progress, 65);
  assert.deepEqual(merged.checklist, savedCard.checklist);
  assert.equal(merged.last_refreshed_at.length > 0, true);
});

test('closed saved issues are identified as inactive candidates', async () => {
  const { isClosedIssue } = await import('../src/boardModel.js');

  assert.equal(isClosedIssue({ state: 'closed' }), true);
  assert.equal(isClosedIssue({ state: 'open' }), false);
});
