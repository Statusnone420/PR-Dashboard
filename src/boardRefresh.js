import {
  ACTIVE_BOARD_COLUMNS,
  BOARD_COLUMNS,
  NO_TOKEN_REFRESH_CONFIRM_THRESHOLD,
  STALE_REFRESH_AGE_MS,
  STALE_REFRESH_LIMIT,
  TOKEN_REFRESH_CONFIRM_THRESHOLD
} from './boardConstants.js';

export const ACTIVE_BOARD_REFRESH_COLUMNS = ACTIVE_BOARD_COLUMNS;
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

function latestRefreshTime(card) {
  const checked = Date.parse(card?.github_activity?.last_checked_at || '');
  const refreshed = Date.parse(card?.last_refreshed_at || '');
  const candidates = [checked, refreshed].filter(Number.isFinite);
  return candidates.length ? Math.max(...candidates) : null;
}

export function isBoardCardStaleForRefresh(card, options = {}) {
  const now = Date.parse(options.now || new Date().toISOString());
  const staleMs = options.staleMs || STALE_REFRESH_AGE_MS;
  const latest = latestRefreshTime(card);
  if (!Number.isFinite(now)) return false;
  if (latest === null) return true;
  return now - latest >= staleMs;
}

export function getStaleBoardRefreshEntries(boardCardsByColumn = {}, options = {}) {
  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : STALE_REFRESH_LIMIT;
  const entries = getActiveBoardRefreshEntries(boardCardsByColumn)
    .filter(entry => isBoardCardStaleForRefresh(entry.card, options));
  return entries.slice(0, Math.max(0, limit));
}

export function getStaleBoardRefreshRequestCount(boardCardsByColumn = {}, options = {}) {
  return getStaleBoardRefreshEntries(boardCardsByColumn, options).length;
}

export function getStaleBoardRefreshTotalCount(boardCardsByColumn = {}, options = {}) {
  return getActiveBoardRefreshEntries(boardCardsByColumn)
    .filter(entry => isBoardCardStaleForRefresh(entry.card, options))
    .length;
}

export function shouldConfirmBatchRefresh({ token, requestCount } = {}) {
  const count = Number(requestCount);
  if (!Number.isFinite(count)) return false;
  return String(token || '').trim()
    ? count > TOKEN_REFRESH_CONFIRM_THRESHOLD
    : count > NO_TOKEN_REFRESH_CONFIRM_THRESHOLD;
}

export function getBatchRefreshWarning({ requestCount, token } = {}) {
  if (String(token || '').trim()) {
    return `This will use ${requestCount} authenticated GitHub REST API requests. Large refreshes can still hit GitHub secondary rate limits. Continue?`;
  }
  return `This will use ${requestCount} public GitHub REST API requests. Public GitHub API limits are tight. Add a token or refresh one card at a time.`;
}

export function shouldWarnPublicBatchRefresh({ token, requestCount } = {}) {
  return shouldConfirmBatchRefresh({ token, requestCount });
}

export function getPublicBatchRefreshWarning(requestCount) {
  return getBatchRefreshWarning({ requestCount, token: '' });
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
  const entries = Array.isArray(options.entries)
    ? options.entries
    : getActiveBoardRefreshEntries(boardCardsByColumn);
  const nextBoard = Object.fromEntries(BOARD_COLUMNS.map(column => [
    column,
    [...(Array.isArray(boardCardsByColumn[column]) ? boardCardsByColumn[column] : [])]
  ]));
  let refreshed = 0;
  let failed = 0;
  let stoppedForRateLimit = false;
  let rateLimitMessage = '';

  for (const entry of entries) {
    if (stoppedForRateLimit) break;
    const column = entry?.column;
    if (!ACTIVE_BOARD_REFRESH_COLUMN_SET.has(column)) continue;
    const cards = nextBoard[column] || [];
    const index = cards.findIndex(card => card.id === entry.card?.id);
    if (index === -1) continue;
    const card = cards[index];
    try {
      const updatedCard = await refreshCard(card, column);
      cards[index] = updatedCard;
      refreshed += 1;
    } catch (error) {
      failed += 1;
      cards[index] = markRefreshFailure(card, error, now);

      if (isRefreshRateLimitError(error)) {
        stoppedForRateLimit = true;
        rateLimitMessage = formatRefreshRateLimitMessage(error);
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
