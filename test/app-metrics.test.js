import test from 'node:test';
import assert from 'node:assert/strict';

test('app metrics summarize board, hidden, proof, and reminder counts from one source', async () => {
  const { summarizeAppMetrics } = await import('../src/appMetrics.js');

  const metrics = summarizeAppMetrics({
    boardCardsByColumn: {
      Considering: [
        { id: 1, state: 'open' },
        { id: 2, state: 'closed' }
      ],
      Working: [
        { id: 3, state: 'open' }
      ],
      Merged: [
        { id: 4, state: 'open' }
      ],
      Passed: [
        { id: 5, state: 'open' }
      ]
    },
    hiddenIssues: [{ key: 'owner/repo#1' }],
    hiddenRepos: [{ key: 'owner/repo' }, { key: 'owner/other' }],
    proofEntries: [{ key: 'owner/repo#4' }],
    reviewReminders: [{ id: 'reminder-1' }, { id: 'reminder-2' }]
  });

  assert.equal(metrics.savedCandidates, 5);
  assert.equal(metrics.activeBoardWork, 2);
  assert.equal(metrics.resolvedOrPassed, 3);
  assert.equal(metrics.hiddenIssues, 1);
  assert.equal(metrics.hiddenRepos, 2);
  assert.equal(metrics.hiddenResults, 3);
  assert.equal(metrics.proofLogEntries, 1);
  assert.equal(metrics.reviewReminders, 2);
});
