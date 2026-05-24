import { ACTIVE_BOARD_COLUMNS, BOARD_COLUMNS, COMPLETED_BOARD_COLUMNS } from './boardConstants.js';
import { isClosedIssue } from './boardModel.js';

export function getBoardEntriesByColumn(boardCardsByColumn = {}) {
  return BOARD_COLUMNS.flatMap(column =>
    (boardCardsByColumn[column] || []).map(card => ({ column, card }))
  );
}

export function summarizeAppMetrics({
  boardCardsByColumn = {},
  hiddenIssues = [],
  hiddenRepos = [],
  proofEntries = [],
  reviewReminders = []
} = {}) {
  const boardEntries = getBoardEntriesByColumn(boardCardsByColumn);
  const activeBoardWork = boardEntries.filter(({ column, card }) =>
    ACTIVE_BOARD_COLUMNS.includes(column) && !isClosedIssue(card)
  ).length;
  const resolvedOrPassed = boardEntries.filter(({ column, card }) =>
    COMPLETED_BOARD_COLUMNS.includes(column) || isClosedIssue(card)
  ).length;

  return {
    boardEntries,
    boardCards: boardEntries.map(entry => entry.card),
    savedCandidates: boardEntries.length,
    activeBoardWork,
    resolvedOrPassed,
    hiddenIssues: hiddenIssues.length,
    hiddenRepos: hiddenRepos.length,
    hiddenResults: hiddenIssues.length + hiddenRepos.length,
    proofLogEntries: proofEntries.length,
    reviewReminders: reviewReminders.length
  };
}
