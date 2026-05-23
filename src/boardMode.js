import { ACTIVE_BOARD_COLUMNS } from './boardConstants.js';
import { isClosedIssue } from './boardModel.js';

export function getActiveBoardCardCount(boardCardsByColumn = {}) {
  return ACTIVE_BOARD_COLUMNS.reduce((total, column) => {
    const cards = boardCardsByColumn[column] || [];
    return total + cards.filter(card => !isClosedIssue(card)).length;
  }, 0);
}

export function getBoardMode(boardCardsByColumn = {}, userMode = 'auto') {
  if (userMode === 'kanban' || userMode === 'compact') return userMode;
  return getActiveBoardCardCount(boardCardsByColumn) <= 3 ? 'compact' : 'kanban';
}
