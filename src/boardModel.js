export const BOARD_COLUMNS = ['Considering', 'Read Docs', 'Asked Maintainer', 'Working', 'PR Open', 'Merged', 'Passed'];

export const BOARD_STORAGE_KEY = 'pr_dashboard_board_cards';
export const BOARD_MIGRATION_KEY = 'pr_dashboard_board_migration_v1';

const SEEDED_MOCK_SIGNATURES = new Set([
  'tailwindlabs/tailwindcss#4812',
  'facebook/react#24901',
  'vercel/next.js#51022',
  'vuejs/core#8291',
  'vitejs/vite#12044',
  'remix-run/remix#6102',
  'sveltejs/svelte#99991',
  'denoland/deno#88881'
]);

export function createEmptyBoard() {
  return Object.fromEntries(BOARD_COLUMNS.map(column => [column, []]));
}

export function getIssueSignature(issue) {
  const repo = issue?.repository?.full_name || '';
  const number = issue?.number || '';
  return `${repo}#${number}`;
}

export function isSeededMockCard(card) {
  return SEEDED_MOCK_SIGNATURES.has(getIssueSignature(card));
}

export function normalizeBoardCards(boardData) {
  const board = createEmptyBoard();
  let migratedCount = 0;

  if (!boardData || typeof boardData !== 'object') {
    return { board, migratedCount };
  }

  for (const column of BOARD_COLUMNS) {
    const cards = Array.isArray(boardData[column]) ? boardData[column] : [];
    for (const card of cards) {
      if (isSeededMockCard(card)) {
        migratedCount += 1;
        continue;
      }
      board[column].push(card);
    }
  }

  return { board, migratedCount };
}

export function loadBoardFromStorage(storage) {
  const savedBoard = storage.getItem(BOARD_STORAGE_KEY);
  if (!savedBoard) {
    return createEmptyBoard();
  }

  try {
    const parsed = JSON.parse(savedBoard);
    const { board, migratedCount } = normalizeBoardCards(parsed);
    if (migratedCount > 0) {
      storage.setItem(BOARD_STORAGE_KEY, JSON.stringify(board));
      storage.setItem(BOARD_MIGRATION_KEY, 'seeded-mock-cards-removed');
    }
    return board;
  } catch {
    storage.removeItem(BOARD_STORAGE_KEY);
    return createEmptyBoard();
  }
}

export function isClosedIssue(issue) {
  return String(issue?.state || '').toLowerCase() === 'closed';
}

export function mergeIssueMetadata(savedCard, apiIssue) {
  return {
    ...savedCard,
    id: apiIssue.id ?? savedCard.id,
    number: apiIssue.number ?? savedCard.number,
    title: apiIssue.title ?? savedCard.title,
    body: apiIssue.body ?? savedCard.body,
    state: apiIssue.state ?? savedCard.state,
    state_reason: apiIssue.state_reason ?? savedCard.state_reason ?? null,
    updated_at: apiIssue.updated_at ?? savedCard.updated_at,
    closed_at: apiIssue.closed_at ?? savedCard.closed_at ?? null,
    labels: Array.isArray(apiIssue.labels) ? apiIssue.labels : savedCard.labels,
    assignee: apiIssue.assignee ?? savedCard.assignee ?? null,
    assignees: Array.isArray(apiIssue.assignees) ? apiIssue.assignees : (savedCard.assignees || []),
    comments: apiIssue.comments ?? savedCard.comments ?? 0,
    html_url: apiIssue.html_url ?? savedCard.html_url,
    repository: {
      ...(savedCard.repository || {}),
      ...(apiIssue.repository || {})
    },
    last_refreshed_at: new Date().toISOString()
  };
}
