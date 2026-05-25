import test from 'node:test';
import assert from 'node:assert/strict';

test('closed cards in active lanes are excluded from Active Review and counted as resolved', async () => {
  const { summarizeDashboardMetrics } = await import('../src/dashboardMetrics.js');

  const metrics = summarizeDashboardMetrics({
    Considering: [
      { id: 1, state: 'closed' },
      { id: 2, state: 'open' }
    ],
    Working: [
      { id: 3, state: 'open' }
    ],
    Passed: [
      { id: 4, state: 'open' }
    ]
  });

  assert.equal(metrics.totalSavedCount, 4);
  assert.equal(metrics.savedCandidateCount, 2);
  assert.equal(metrics.activeReviewCount, 2);
  assert.equal(metrics.resolvedOrPassedCount, 2);
  assert.equal(metrics.activeReviewProgress, 50);
  assert.equal(metrics.resolvedProgress, 50);
});
