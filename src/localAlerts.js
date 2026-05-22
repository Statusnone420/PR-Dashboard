import { isClosedIssue } from './boardModel.js';
import { getIssueDisplayKey } from './issueKeys.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_COLUMNS = ['Considering', 'Read Docs', 'Asked Maintainer', 'Working', 'PR Open'];

function ageDays(value, now) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return 0;
  return Math.floor((now - time) / DAY_MS);
}

function alertBase(kind, card, column, message) {
  return {
    kind,
    cardId: card?.id,
    key: getIssueDisplayKey(card) || String(card?.id || ''),
    title: card?.title || 'Saved issue',
    column,
    message
  };
}

export function buildLocalAlerts(boardCardsByColumn = {}, options = {}) {
  const now = Date.parse(options.now || new Date().toISOString());
  const alerts = [];
  const maintainerDays = options.maintainerDays || 3;
  const prDays = options.prDays || 3;
  const refreshDays = options.refreshDays || 3;

  for (const card of boardCardsByColumn['Asked Maintainer'] || []) {
    if (ageDays(card.column_entered_at || card.last_moved_at, now) >= maintainerDays) {
      alerts.push(alertBase('maintainer-follow-up', card, 'Asked Maintainer', 'Asked Maintainer has been waiting for a local follow-up.'));
    }
  }

  for (const card of boardCardsByColumn['PR Open'] || []) {
    if (ageDays(card.column_entered_at || card.last_moved_at, now) >= prDays) {
      alerts.push(alertBase('pr-follow-up', card, 'PR Open', 'PR Open has been waiting for review or CI follow-up.'));
    }
  }

  for (const column of ACTIVE_COLUMNS) {
    for (const card of boardCardsByColumn[column] || []) {
      if (isClosedIssue(card)) {
        alerts.push(alertBase('closed-active-card', card, column, 'This active saved issue is closed on GitHub. Move it to Passed or Merged locally.'));
      }
    }
  }

  for (const column of ACTIVE_COLUMNS) {
    for (const card of boardCardsByColumn[column] || []) {
      if (ageDays(card.last_refreshed_at || card.saved_at, now) >= refreshDays) {
        alerts.push(alertBase('stale-refresh', card, column, 'Saved card has not been refreshed recently.'));
      }
    }
  }

  return alerts;
}
