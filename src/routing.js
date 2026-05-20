const VALID_SCREENS = new Set(['dashboard', 'find-issues', 'board', 'settings']);

export function screenFromHash(hash) {
  const screen = String(hash || '').replace(/^#/, '');
  return VALID_SCREENS.has(screen) ? screen : 'dashboard';
}
