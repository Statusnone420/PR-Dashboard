import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyBoard } from '../src/boardModel.js';
import { summarizeAppMetrics } from '../src/appMetrics.js';

function issue(id, overrides = {}) {
  return {
    id,
    number: id,
    state: 'open',
    repository: { full_name: 'owner/repo' },
    ...overrides
  };
}

test('saved candidate metrics exclude final and closed board cards', () => {
  const boardCardsByColumn = createEmptyBoard();
  boardCardsByColumn.Considering.push(issue(1));
  boardCardsByColumn.Working.push(issue(2, { state: 'closed' }));
  boardCardsByColumn.Merged.push(issue(3));
  boardCardsByColumn.Passed.push(issue(4));

  const metrics = summarizeAppMetrics({ boardCardsByColumn });

  assert.equal(metrics.savedCandidates, 1);
  assert.equal(metrics.activeBoardWork, 1);
  assert.equal(metrics.resolvedOrPassed, 3);
});
