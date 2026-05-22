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
