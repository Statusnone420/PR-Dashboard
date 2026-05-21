import { BOARD_COLUMNS, isClosedIssue } from './boardModel.js';

const FINAL_COLUMNS = new Set(['Merged', 'Passed']);

export const DASHBOARD_RESUME_COLUMN_ORDER = [
  'Working',
  ...BOARD_COLUMNS.filter(column => column !== 'Working' && !FINAL_COLUMNS.has(column))
];

export function hasConfiguredGitHubToken(githubToken) {
  return String(githubToken || '').trim().length > 0;
}

export function getActiveResumeTarget(boardCards = {}) {
  for (const column of DASHBOARD_RESUME_COLUMN_ORDER) {
    const cards = Array.isArray(boardCards[column]) ? boardCards[column] : [];
    const card = cards.find(candidate => !isClosedIssue(candidate));
    if (card) {
      return { card, column };
    }
  }

  return null;
}

export function getDashboardHeroRecommendation({ boardCards, githubToken } = {}) {
  const resumeTarget = getActiveResumeTarget(boardCards);
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
