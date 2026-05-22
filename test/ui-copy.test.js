import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('primary navigation labels contribution finding, not generic issue search', () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(indexHtml, />\s*Find Contributions\s*</);
  assert.doesNotMatch(indexHtml, />\s*Find Issues\s*</);
  assert.doesNotMatch(mainJs, /"Find Issues" search results/);
});

test('contribution coach UI exposes a best-for chip and inspector brief', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainJs, /Fit:/);
  assert.match(mainJs, /Best fit/);
  assert.match(mainJs, /Contribution Brief/);
});

test('settings exposes hidden results management copy', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainJs, /Hidden Results/);
  assert.match(mainJs, /Unhide/);
  assert.match(mainJs, /Clear Hidden/);
});

test('profile, proof log, export import, and local alerts are visible product surfaces', () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainJs, /Proof Log/);
  assert.match(mainJs, /Export Local Data/);
  assert.match(mainJs, /Import Local Data/);
  assert.match(mainJs, /Local alerts/);
  assert.doesNotMatch(indexHtml, /aria-disabled="true" disabled/);
  assert.doesNotMatch(indexHtml, />\s*JD\s*</);
});

test('lookup hidden recovery and board-only proof status are represented in UI copy', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainJs, /Hidden locally/);
  assert.match(mainJs, /In Proof Log/);
  assert.match(mainJs, /Not in Proof Log/);
  assert.match(mainJs, /applyHiddenFilter/);
  assert.doesNotMatch(mainJs, /proof-log-add-btn/);
  assert.doesNotMatch(mainJs, /inspector-proof-log-btn/);
  assert.doesNotMatch(mainJs, /source:\s*['"]manual_lookup['"]/);
});

test('profile avatar markup is safe and falls back to initials', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainJs, /referrerpolicy="no-referrer"/);
  assert.match(mainJs, /loading="lazy"/);
  assert.match(mainJs, /decoding="async"/);
  assert.match(mainJs, /user-avatar-initials/);
});

test('empty results recovery uses broaden search copy', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainJs, /Broaden Search/);
  assert.match(mainJs, /keeps your search text/i);
  assert.doesNotMatch(mainJs, />Relax Filters</);
});

test('dashboard exposes richer local metric cards', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainJs, /Active Review/);
  assert.match(mainJs, /Local contribution candidates/);
  assert.match(mainJs, /Filtered from future searches/);
  assert.match(mainJs, /Board Momentum/);
});
