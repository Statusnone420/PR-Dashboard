export const REVIEW_FLOW_COLUMNS = [
  'Considering',
  'Read Docs',
  'Asked Maintainer',
  'Working',
  'PR Open',
  'Merged',
  'Passed'
];

export const REVIEW_FLOW_COLORS = {
  Considering: 'rgba(167, 139, 250, 0.9)',
  'Read Docs': 'rgba(96, 165, 250, 0.9)',
  'Asked Maintainer': 'rgba(251, 191, 36, 0.9)',
  Working: 'rgba(52, 211, 153, 0.9)',
  'PR Open': 'rgba(45, 212, 191, 0.9)',
  Merged: 'rgba(34, 197, 94, 0.9)',
  Passed: 'rgba(239, 68, 68, 0.85)'
};

const NEXT_MOVES = {
  Considering: 'Next: triage this candidate, then move it to Read Docs or pass.',
  'Read Docs': 'Next: confirm setup, likely files, and test commands.',
  'Asked Maintainer': 'Next: wait for a reply or set a follow-up decision.',
  Working: 'Next: keep the checklist moving and open a draft PR when ready.',
  'PR Open': 'Next: watch reviewer feedback and CI.',
  Merged: 'Merged work is complete. Pick the next candidate.',
  Passed: 'Passed issues are resolved locally. Review whether any should stay hidden.'
};

function countColumn(boardCardsByColumn, column) {
  const cards = boardCardsByColumn?.[column];
  return Array.isArray(cards) ? cards.length : 0;
}

function lanePercent(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function strongestLane(lanes) {
  return lanes.reduce((best, lane) => {
    if (!best) return lane;
    return lane.count > best.count ? lane : best;
  }, null);
}

export function getReviewFlowNextMove(column) {
  return NEXT_MOVES[column] || 'Next: open the board and choose the next local review step.';
}

export function summarizeReviewFlow(boardCardsByColumn = {}) {
  const rawLanes = REVIEW_FLOW_COLUMNS.map(column => ({
    column,
    count: countColumn(boardCardsByColumn, column)
  }));
  const total = rawLanes.reduce((sum, lane) => sum + lane.count, 0);
  const lanes = rawLanes
    .filter(lane => lane.count > 0)
    .map(lane => ({
      ...lane,
      percent: lanePercent(lane.count, total),
      nextMove: getReviewFlowNextMove(lane.column)
    }));
  const dominant = strongestLane(lanes);

  if (!dominant) {
    return {
      total: 0,
      headline: 'No saved issues yet',
      nextMove: 'Save issues to start tracking review flow.',
      lanes: [],
      dominantColumn: null
    };
  }

  return {
    total,
    headline: `${dominant.count} in ${dominant.column}`,
    nextMove: dominant.nextMove,
    lanes,
    dominantColumn: dominant.column
  };
}
