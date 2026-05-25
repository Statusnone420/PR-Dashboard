import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BOARD_LAYOUT_MAX_WIDTH } from '../src/boardConstants.js';

test('dark mode select options have explicit readable colors', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(css, /select\s+option/);
  assert.match(css, /background-color:\s*var\(--surface-container\)/);
  assert.match(css, /color:\s*var\(--on-surface\)/);
});

test('reusable interaction and metric classes are defined in CSS', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

  for (const className of [
    'interactive-card',
    'interactive-row',
    'action-button',
    'metric-card',
    'metric-progress-fill',
    'review-flow-chip',
    'review-flow-segment'
  ]) {
    assert.match(css, new RegExp(`\\.${className}\\b`));
  }
});

test('board uses responsive grid contract instead of fixed horizontal row', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const mainJs = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(css, /\.board-active-grid\b/);
  assert.match(css, /\.board-completed-grid\b/);
  assert.match(css, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /max-width:\s*var\(--board-layout-max-width\)/);
  assert.match(mainJs, new RegExp(`--board-layout-max-width:\\s*\\$\\{BOARD_LAYOUT_MAX_WIDTH\\}px`));
  assert.equal(typeof BOARD_LAYOUT_MAX_WIDTH, 'number');
  assert.match(mainJs, /Active workflow/);
  assert.match(mainJs, /Completed/);
  assert.doesNotMatch(mainJs, /min-w-max/);
  assert.doesNotMatch(css, /w-\[280px\]|shrink-0/);
});

test('board compact mode styles are defined without inspector tab styles', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.board-compact-layout\b/);
  assert.match(css, /\.board-compact-cards\b/);
  assert.match(css, /\.board-compact-card\b/);
  assert.match(css, /\.board-compact-lanes\b/);
  assert.match(css, /\.board-compact-lane-row\b/);
  assert.doesNotMatch(css, /\.inspector-tab\b/);
});

test('app scrollbars and tooltip contracts are defined in CSS', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-color:\s*rgba\(82,\s*82,\s*91,\s*0\.45\)\s*transparent/);
  assert.match(css, /::-webkit-scrollbar/);
  assert.match(css, /::-webkit-scrollbar-thumb/);
  assert.match(css, /:hover::-webkit-scrollbar-thumb/);
  assert.match(css, /:focus-within::-webkit-scrollbar-thumb/);
  assert.match(css, /\.board-lane-cards-container/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /\[data-tooltip\]/);
  assert.match(css, /\[data-tooltip\]::before/);
  assert.match(css, /\[data-tooltip\]:hover::before/);
  assert.match(css, /\[data-tooltip\]:focus-visible::before/);
  assert.match(css, /white-space:\s*normal/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\[data-tooltip\]\[data-tooltip-suppressed='true'\]::before/);
  assert.match(css, /@media\s*\(hover:\s*none\),\s*\(pointer:\s*coarse\)/);
});

test('advanced context scan loading animation contract is defined', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(css, /@keyframes\s+scanLine/);
  assert.match(css, /0%\s*{\s*top:\s*-2px;\s*opacity:\s*0\s*}/);
  assert.match(css, /5%\s*{\s*opacity:\s*1\s*}/);
  assert.match(css, /90%\s*{\s*opacity:\s*\.8\s*}/);
  assert.match(css, /100%\s*{\s*top:\s*100%;\s*opacity:\s*0\s*}/);
  assert.match(css, /@keyframes\s+scanPulse/);
  assert.match(css, /0%,\s*100%\s*{\s*opacity:\s*\.3\s*}/);
  assert.match(css, /50%\s*{\s*opacity:\s*1\s*}/);
  assert.match(css, /@keyframes\s+fadeUp/);
  assert.match(css, /from\s*{\s*opacity:\s*0;\s*transform:\s*translateY\(4px\)\s*}/);
  assert.match(css, /to\s*{\s*opacity:\s*1;\s*transform:\s*translateY\(0\)\s*}/);

  assert.match(css, /\.advanced-context-card\b/);
  assert.match(css, /min-height:\s*94px/);
  assert.match(css, /@media\s*\(min-width:\s*1024px\)/);
  assert.match(css, /min-height:\s*152px/);
  assert.match(css, /\.advanced-context-card-loading\b/);
  assert.match(css, /background(?:-color)?:\s*#0d1117/i);
  assert.match(css, /border-color:\s*#1a2332/i);
  assert.match(css, /\.advanced-context-scan-line\b/);
  assert.match(css, /background(?:-color)?:\s*#378ADD/i);
  assert.match(css, /animation:\s*scanLine\s+2s\s+ease-in-out\s+infinite/);
  assert.match(css, /\.advanced-context-dot:nth-child\(2\)/);
  assert.match(css, /background(?:-color)?:\s*#534AB7/i);
  assert.match(css, /\.advanced-context-dot:nth-child\(3\)/);
  assert.match(css, /background(?:-color)?:\s*#5DCAA5/i);
  assert.match(css, /\.advanced-context-card-loaded\b/);
  assert.match(css, /animation:\s*fadeUp\s+220ms\s+ease-out\s+both/);
});

test('inspector and finder polish styles are defined', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.inspector-resize-handle\b/);
  assert.match(css, /cursor:\s*col-resize/);
  assert.match(css, /\.inspector-resizing\b/);
  assert.match(css, /@media\s*\(max-width:\s*779px\)/);
  assert.match(css, /\.advanced-context-grid\b/);
  assert.match(css, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(220px,\s*1fr\)\)/);
  assert.match(css, /\.filter-select\b/);
  assert.match(css, /\.filter-disclosure\b/);
  assert.match(css, /\.filter-disclosure\s*>\s*summary/);
  assert.match(css, /\.mobile-filter-disclosure\b/);
  assert.match(css, /\.mobile-filter-summary\b/);
  assert.match(css, /\.mobile-filter-body\b/);
  assert.match(css, /@media\s*\(min-width:\s*1024px\)[\s\S]*\.mobile-filter-summary/);
});

test('platform evidence badges stay compact and square', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const badgeGroup = css.match(/\.platform-evidence-badges\s*{(?<body>[^}]*)}/)?.groups?.body || '';
  const badgeChip = css.match(/\.platform-evidence-chip\s*{(?<body>[^}]*)}/)?.groups?.body || '';
  const macosIcon = css.match(/\.platform-evidence-icon\[data-platform='macos'\]\s*{(?<body>[^}]*)}/)?.groups?.body || '';

  assert.match(css, /\.platform-evidence-badges\b/);
  assert.match(badgeGroup, /display:\s*inline-flex/);
  assert.match(badgeGroup, /gap:\s*0\.25rem/);
  assert.match(badgeChip, /width:\s*1\.375rem/);
  assert.match(badgeChip, /height:\s*1\.375rem/);
  assert.match(badgeChip, /min-width:\s*1\.375rem/);
  assert.match(badgeChip, /min-height:\s*1\.375rem/);
  assert.match(badgeChip, /padding:\s*0/);
  assert.match(macosIcon, /filter:\s*invert\(1\)/);
});
