import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

  assert.match(css, /\.kanban-board-grid\b/);
  assert.match(css, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(260px,\s*1fr\)\)/);
  assert.doesNotMatch(mainJs, /min-w-max/);
  assert.doesNotMatch(css, /w-\[280px\]|shrink-0/);
});
