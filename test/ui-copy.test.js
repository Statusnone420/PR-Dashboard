import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

function readCopySources() {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const boardRefreshJs = readFileSync(new URL('../src/boardRefresh.js', import.meta.url), 'utf8');
  return { indexHtml, mainJs, boardRefreshJs };
}

function normalizeCopy(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function htmlVisibleCopy(source) {
  const attributeCopy = [];
  source.replace(/\b(?:aria-label|alt|placeholder|title)=["']([^"']*)["']/g, (_, value) => {
    attributeCopy.push(value);
    return '';
  });

  const textCopy = source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return normalizeCopy([textCopy, ...attributeCopy].join(' '));
}

function jsStringLiterals(source) {
  const literals = [];
  const pattern = /`([\s\S]*?)`|'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    literals.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return literals;
}

function visibleAppCopy({ indexHtml, mainJs, boardRefreshJs = '' }) {
  const jsCopy = jsStringLiterals(mainJs)
    .map(literal => htmlVisibleCopy(literal))
    .join(' ');
  const boardRefreshCopy = jsStringLiterals(boardRefreshJs)
    .map(literal => htmlVisibleCopy(literal))
    .join(' ');
  return normalizeCopy(`${htmlVisibleCopy(indexHtml)} ${jsCopy} ${boardRefreshCopy}`);
}

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('primary navigation labels contribution finding, not generic issue search', () => {
  const { indexHtml, mainJs } = readCopySources();

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

test('profile, proof log, export import, and review reminders are visible product surfaces', () => {
  const { indexHtml, mainJs, boardRefreshJs } = readCopySources();
  const copy = visibleAppCopy({ indexHtml, mainJs, boardRefreshJs });

  assert.match(mainJs, /Proof Log/);
  assert.match(mainJs, /Export Local Data/);
  assert.match(mainJs, /Import Local Data/);
  assert.match(mainJs, /Review reminders/);
  assert.match(mainJs, /Refresh this card/);
  assert.match(mainJs, /Refresh stale cards/);
  assert.match(mainJs, /Refresh all active cards/);
  assert.match(mainJs, /Mark reviewed/);
  assert.match(mainJs, /New GitHub activity/);
  assert.match(mainJs, /No changes since last refresh/);
  assert.match(copy, /Public GitHub API limits are tight/);
  assert.match(copy, /GitHub REST API rate limits/);
  assert.match(mainJs, /No review reminders right now\./);
  assert.doesNotMatch(indexHtml, /aria-disabled="true" disabled/);
  assert.doesNotMatch(indexHtml, />\s*JD\s*</);
});

test('lookup hidden recovery is represented without inspector proof status', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainJs, /Hidden locally/);
  assert.match(mainJs, /Lookup can still recover this item/);
  assert.match(mainJs, /applyHiddenFilter/);
  assert.doesNotMatch(mainJs, /proof-status-chip/);
  assert.doesNotMatch(mainJs, /Proof Log status/);
  assert.doesNotMatch(mainJs, /Not in Proof Log/);
  assert.doesNotMatch(mainJs, /inspector-proof-log/);
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

  assert.match(mainJs, /Active board work/);
  assert.match(mainJs, /Contribution candidates/);
  assert.match(mainJs, /Filtered from future searches/);
  assert.match(mainJs, /Board flow/);
});

test('visible app copy rejects banned product wording', () => {
  const sources = readCopySources();
  const copy = visibleAppCopy(sources);

  for (const banned of [
    /Local alerts/,
    /Local notifications/,
    /Proof Board/,
    /proof board/,
    /\bpolling\b/i,
    /\blive sync\b/i,
    /\breal-time\b/i,
    /\bpush notifications\b/i,
    /\bbackend sync\b/i,
    /beautiful thing/,
    /magic/
  ]) {
    assert.doesNotMatch(copy, banned);
  }

  assert.doesNotMatch(copy, /\bwins\b/i);
  assert.doesNotMatch(copy, /\bmomentum\b/i);
  assert.match(copy, /Review reminders/);
  assert.match(copy, /No review reminders right now\./);
});

test('result cards and inspector action center do not expose proof log controls', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const resultCards = sliceBetween(mainJs, 'function renderIssueCardsList', 'function bindIssueCardListEvents');
  const actionCenter = sliceBetween(mainJs, '<!-- Actions buttons inside details -->', '<!-- Description Block -->');

  assert.doesNotMatch(resultCards, /Proof Log|proof-log|proof-status|proofStatus/);
  assert.match(actionCenter, /Save issue/);
  assert.match(actionCenter, /Saved to board/);
  assert.match(actionCenter, /Hide issue/);
  assert.match(actionCenter, /Hide repo/);
  assert.match(actionCenter, /Unhide/);
  assert.match(actionCenter, /Open on GitHub/);
  assert.doesNotMatch(actionCenter, /Proof Log|proof-status-chip|proofStatus|workspace_premium/);
});

test('refresh batch confirmation uses app modal instead of native browser confirm', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainJs, /refresh-confirm-dialog/);
  assert.match(mainJs, /Refresh cards/);
  assert.doesNotMatch(mainJs, /window\.confirm/);
});

test('inspector action plan checkbox handler does not reopen inspector', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const handlerMatch = mainJs.match(/document\.querySelectorAll\('\.inspector-task-checkbox'\)[\s\S]*?\n  \}\);\n\}/);

  assert.ok(handlerMatch);
  assert.doesNotMatch(handlerMatch[0], /openInspector\(\)/);
});
