import test from 'node:test';
import assert from 'node:assert/strict';

test('board mode defaults to compact for zero to three active cards', async () => {
  const { getBoardMode } = await import('../src/boardMode.js');

  assert.equal(getBoardMode({}), 'compact');
  assert.equal(getBoardMode({ Considering: [{ id: 1 }] }), 'compact');
  assert.equal(getBoardMode({ Considering: [{ id: 1 }, { id: 2 }], Working: [{ id: 3 }] }), 'compact');
});

test('board mode defaults to kanban for four or more active cards', async () => {
  const { getBoardMode } = await import('../src/boardMode.js');

  assert.equal(getBoardMode({
    Considering: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  }), 'kanban');
});

test('board mode ignores completed and closed cards for compact threshold', async () => {
  const { getBoardMode } = await import('../src/boardMode.js');

  assert.equal(getBoardMode({
    Considering: [{ id: 1 }],
    Merged: [{ id: 2 }],
    Passed: [{ id: 3 }],
    Working: [{ id: 4, state: 'closed', closed_at: '2026-05-23T00:00:00.000Z' }]
  }), 'compact');
});

test('explicit board mode overrides auto selection', async () => {
  const { getBoardMode } = await import('../src/boardMode.js');

  assert.equal(getBoardMode({}, 'kanban'), 'kanban');
  assert.equal(getBoardMode({ Considering: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }, 'compact'), 'compact');
});
