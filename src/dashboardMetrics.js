import { BOARD_COLUMNS, isClosedIssue } from './boardModel.js';

export const ACTIVE_REVIEW_COLUMNS = ['Considering', 'Read Docs', 'Asked Maintainer', 'Working', 'PR Open'];
export const RESOLVED_BOARD_COLUMNS = ['Merged', 'Passed'];

function safeProgressPercent(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function getBoardEntriesByColumn(boardCardsByColumn = {}) {
  return BOARD_COLUMNS.flatMap(column => (boardCardsByColumn[column] || []).map(card => ({ column, card })));
}

export function isActiveReviewEntry(entry) {
  return ACTIVE_REVIEW_COLUMNS.includes(entry?.column) && !isClosedIssue(entry?.card);
}

export function isResolvedOrPassedEntry(entry) {
  return RESOLVED_BOARD_COLUMNS.includes(entry?.column) || isClosedIssue(entry?.card);
}

export function summarizeDashboardMetrics(boardCardsByColumn = {}) {
  const boardEntries = getBoardEntriesByColumn(boardCardsByColumn);
  const boardCards = boardEntries.map(entry => entry.card);
  const totalSavedCount = boardCards.length;
  const activeReviewCount = boardEntries.filter(isActiveReviewEntry).length;
  const resolvedOrPassedCount = boardEntries.filter(isResolvedOrPassedEntry).length;

  return {
    boardEntries,
    boardCards,
    totalSavedCount,
    activeReviewCount,
    resolvedOrPassedCount,
    activeReviewProgress: safeProgressPercent(activeReviewCount, totalSavedCount),
    resolvedProgress: safeProgressPercent(resolvedOrPassedCount, totalSavedCount)
  };
}
