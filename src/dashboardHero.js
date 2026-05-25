import { ACTIVE_BOARD_COLUMNS, BOARD_COLUMNS, isClosedIssue } from './boardModel.js';

const FINAL_COLUMNS = new Set(['Merged', 'Passed']);

export const DASHBOARD_RESUME_COLUMN_ORDER = [
  'Working',
  ...BOARD_COLUMNS.filter(column => column !== 'Working' && !FINAL_COLUMNS.has(column))
];

export function hasConfiguredGitHubToken(githubToken) {
  return String(githubToken || '').trim().length > 0;
}

function resolveHiddenFilter(options = {}) {
  return typeof options.hiddenFilter === 'function'
    ? options.hiddenFilter
    : cards => cards;
}

export function getActiveResumeTarget(boardCards = {}, options = {}) {
  const hiddenFilter = resolveHiddenFilter(options);
  for (const column of DASHBOARD_RESUME_COLUMN_ORDER) {
    const cards = Array.isArray(boardCards[column]) ? boardCards[column] : [];
    const visibleCards = hiddenFilter([...cards]);
    const card = visibleCards.find(candidate => !isClosedIssue(candidate));
    if (card) {
      return { card, column };
    }
  }

  return null;
}

export function getDashboardHeroRecommendation({ boardCards, githubToken, hiddenFilter } = {}) {
  const resumeTarget = getActiveResumeTarget(boardCards, { hiddenFilter });
  if (resumeTarget) {
    return {
      kind: 'resume',
      ...resumeTarget
    };
  }

  if (!hasConfiguredGitHubToken(githubToken)) {
    return { kind: 'configure-token' };
  }

  return { kind: 'find-contributions' };
}

export function getDashboardSavedPreviewCards(boardCards = {}, options = {}) {
  const hiddenFilter = resolveHiddenFilter(options);
  const previewSource = ACTIVE_BOARD_COLUMNS.flatMap(column => (
    Array.isArray(boardCards[column]) ? boardCards[column] : []
  )).filter(card => !isClosedIssue(card));
  return hiddenFilter(previewSource);
}
