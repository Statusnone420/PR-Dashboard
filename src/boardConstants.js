export const ACTIVE_BOARD_COLUMNS = ['Considering', 'Read Docs', 'Asked Maintainer', 'Working', 'PR Open'];
export const COMPLETED_BOARD_COLUMNS = ['Merged', 'Passed'];
export const BOARD_COLUMNS = [...ACTIVE_BOARD_COLUMNS, ...COMPLETED_BOARD_COLUMNS];

export const STALE_REFRESH_LIMIT = 10;
export const STALE_REFRESH_HOURS = 24;
export const STALE_REFRESH_AGE_MS = STALE_REFRESH_HOURS * 60 * 60 * 1000;
export const NO_TOKEN_REFRESH_CONFIRM_THRESHOLD = 5;
export const TOKEN_REFRESH_CONFIRM_THRESHOLD = 25;
export const BOARD_LAYOUT_MAX_WIDTH = 1800;
