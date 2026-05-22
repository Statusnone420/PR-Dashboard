import { BOARD_COLUMNS } from './boardModel.js';

export const ACTIVE_BOARD_REFRESH_COLUMNS = ['Considering', 'Read Docs', 'Asked Maintainer', 'Working', 'PR Open'];
const ACTIVE_BOARD_REFRESH_COLUMN_SET = new Set(ACTIVE_BOARD_REFRESH_COLUMNS);

export function getActiveBoardRefreshEntries(boardCardsByColumn = {}) {
  return ACTIVE_BOARD_REFRESH_COLUMNS.flatMap(column => {
    const cards = Array.isArray(boardCardsByColumn[column]) ? boardCardsByColumn[column] : [];
    return cards.map(card => ({ column, card }));
  });
}

export function getActiveBoardRefreshRequestCount(boardCardsByColumn = {}) {
  return getActiveBoardRefreshEntries(boardCardsByColumn).length;
}

export function shouldWarnPublicBatchRefresh({ token, requestCount } = {}) {
  return !String(token || '').trim() && Number(requestCount) > 5;
}

export function getPublicBatchRefreshWarning(requestCount) {
  return `This will use ${requestCount} public GitHub API requests. Public GitHub API limits are tight. Add a token or refresh one card at a time.`;
}

export function isRefreshRateLimitError(error) {
  return Boolean(error?.isRateLimit || error?.name === 'GitHubRefreshRateLimitError');
}

export function formatRefreshRateLimitMessage(error) {
  const retryAfter = Number(error?.retryAfter);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return `GitHub API rate limit reached. Retry after ${retryAfter} seconds before refreshing again.`;
  }

  const reset = Number(error?.rateLimit?.reset);
  if (Number.isFinite(reset) && reset > 0) {
    const resetDate = new Date(reset * 1000);
    return `GitHub API rate limit reached. Try again after ${resetDate.toLocaleTimeString()}.`;
  }

  return 'GitHub API rate limit reached. Wait before refreshing again.';
}

export function getSafeRefreshErrorMessage(error) {
  return isRefreshRateLimitError(error)
    ? formatRefreshRateLimitMessage(error)
    : 'GitHub refresh failed for this card.';
}

function markRefreshFailure(card, error, now) {
  return {
    ...card,
    refresh_error: getSafeRefreshErrorMessage(error),
    last_refreshed_at: now
  };
}

export async function refreshActiveBoardCardsSerially(boardCardsByColumn = {}, refreshCard, options = {}) {
  const now = options.now || new Date().toISOString();
  const nextBoard = {};
  let refreshed = 0;
  let failed = 0;
  let stoppedForRateLimit = false;
  let rateLimitMessage = '';

  for (const column of BOARD_COLUMNS) {
    const cards = Array.isArray(boardCardsByColumn[column]) ? boardCardsByColumn[column] : [];
    nextBoard[column] = [];

    if (!ACTIVE_BOARD_REFRESH_COLUMN_SET.has(column) || stoppedForRateLimit) {
      nextBoard[column].push(...cards);
      continue;
    }

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      try {
        const updatedCard = await refreshCard(card, column);
        nextBoard[column].push(updatedCard);
        refreshed += 1;
      } catch (error) {
        failed += 1;
        nextBoard[column].push(markRefreshFailure(card, error, now));

        if (isRefreshRateLimitError(error)) {
          stoppedForRateLimit = true;
          rateLimitMessage = formatRefreshRateLimitMessage(error);
          nextBoard[column].push(...cards.slice(index + 1));
          break;
        }
      }
    }
  }

  return {
    nextBoard,
    refreshed,
    failed,
    stoppedForRateLimit,
    rateLimitMessage
  };
}
