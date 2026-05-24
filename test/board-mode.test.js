import test from 'node:test';
import assert from 'node:assert/strict';

function makeBoard(activeCount, extra = {}) {
  const board = {
    Considering: [],
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: [],
    ...extra
  };
  board.Considering = Array.from({ length: activeCount }, (_, index) => ({
    id: index + 1,
    state: 'open'
  }));
  return board;
}

test('board mode auto-resolves to compact for up to three active cards', async () => {
  const { getActiveBoardCardCount, getBoardMode } = await import('../src/boardMode.js');

  assert.equal(getActiveBoardCardCount(makeBoard(0)), 0);
  assert.equal(getBoardMode(makeBoard(0), 'auto'), 'compact');
  assert.equal(getBoardMode(makeBoard(3), 'auto'), 'compact');
});

test('board mode auto-resolves to full kanban when active work is broad', async () => {
  const { getBoardMode } = await import('../src/boardMode.js');

  assert.equal(getBoardMode(makeBoard(4), 'auto'), 'kanban');
});

test('board mode ignores closed active-lane cards', async () => {
  const { getActiveBoardCardCount, getBoardMode } = await import('../src/boardMode.js');
  const board = makeBoard(3, {
    Working: [
      { id: 101, state: 'closed' },
      { id: 102, state: 'closed', state_reason: 'not_planned' }
    ],
    Passed: [
      { id: 201, state: 'open' }
    ]
  });

  assert.equal(getActiveBoardCardCount(board), 3);
  assert.equal(getBoardMode(board, 'auto'), 'compact');
});

test('board mode respects explicit compact and full kanban overrides', async () => {
  const { getBoardMode } = await import('../src/boardMode.js');

  assert.equal(getBoardMode(makeBoard(8), 'compact'), 'compact');
  assert.equal(getBoardMode(makeBoard(1), 'kanban'), 'kanban');
});
