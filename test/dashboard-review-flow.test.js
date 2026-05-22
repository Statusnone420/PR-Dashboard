import test from 'node:test';
import assert from 'node:assert/strict';

test('review flow hides zero-count lanes and explains a single considering card', async () => {
  const { summarizeReviewFlow } = await import('../src/dashboardReviewFlow.js');

  const summary = summarizeReviewFlow({
    Considering: [{ id: 1 }],
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: []
  });

  assert.equal(summary.total, 1);
  assert.equal(summary.headline, '1 in Considering');
  assert.equal(summary.lanes.length, 1);
  assert.equal(summary.lanes[0].column, 'Considering');
  assert.equal(summary.lanes[0].count, 1);
  assert.equal(summary.lanes[0].percent, 100);
  assert.match(summary.nextMove, /triage this candidate/i);
});

test('review flow keeps empty boards calm and instructive', async () => {
  const { summarizeReviewFlow } = await import('../src/dashboardReviewFlow.js');

  const summary = summarizeReviewFlow({});

  assert.equal(summary.total, 0);
  assert.equal(summary.headline, 'No saved issues yet');
  assert.deepEqual(summary.lanes, []);
  assert.equal(summary.nextMove, 'Save issues to start tracking review flow.');
});

test('review flow gives the dominant lane an actionable next move', async () => {
  const { summarizeReviewFlow } = await import('../src/dashboardReviewFlow.js');

  const summary = summarizeReviewFlow({
    Considering: [{ id: 1 }],
    'Asked Maintainer': [{ id: 2 }, { id: 3 }],
    Working: [{ id: 4 }]
  });

  assert.equal(summary.headline, '2 in Asked Maintainer');
  assert.deepEqual(summary.lanes.map(lane => lane.column), ['Considering', 'Asked Maintainer', 'Working']);
  assert.match(summary.nextMove, /wait for a reply/i);
});
