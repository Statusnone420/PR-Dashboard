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

test('settings token input discourages browser password saving', () => {
  const { mainJs } = readCopySources();
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const settings = sliceBetween(mainJs, 'function renderSettings(container)', 'function openInspector()');
  const tokenInput = settings.match(/<input[^>]+id="settings-pat-input"[^>]*>/)?.[0] || '';

  assert.match(tokenInput, /type="text"/);
  assert.doesNotMatch(tokenInput, /type="password"/);
  assert.match(tokenInput, /autocomplete="off"/);
  assert.doesNotMatch(tokenInput, /autocomplete="new-password"/);
  assert.match(tokenInput, /secure-token-input/);
  assert.match(tokenInput, /data-token-visible="false"/);
  assert.match(tokenInput, /autocapitalize="off"/);
  assert.match(tokenInput, /autocorrect="off"/);
  assert.match(tokenInput, /spellcheck="false"/);
  assert.match(tokenInput, /data-lpignore="true"/);
  assert.match(tokenInput, /data-1p-ignore="true"/);
  assert.match(tokenInput, /data-bwignore="true"/);
  assert.match(styles, /\.secure-token-input\[data-token-visible='false'\]/);
  assert.match(styles, /-webkit-text-security:\s*disc/);
  assert.match(settings, /patInput\.dataset\.tokenVisible/);
});

test('profile, proof log, export import, and review reminders are visible product surfaces', () => {
  const { indexHtml, mainJs, boardRefreshJs } = readCopySources();
  const copy = visibleAppCopy({ indexHtml, mainJs, boardRefreshJs });

  assert.match(mainJs, /Proof Log/);
  assert.match(mainJs, /Export Local Data/);
  assert.match(mainJs, /Import Local Data/);
  assert.match(mainJs, /Review reminders/);
  assert.match(copy, /API limits/);
  assert.match(copy, /REST\/core/);
  assert.match(copy, /Search/);
  assert.match(copy, /Check limits/);
  assert.match(mainJs, /Refresh this card/);
  assert.match(mainJs, /Refresh stale cards/);
  assert.match(mainJs, /Refresh all active cards/);
  assert.match(mainJs, /Mark reviewed/);
  assert.match(mainJs, /New GitHub activity/);
  assert.match(mainJs, /No changes since last refresh/);
  assert.match(copy, /Public GitHub API limits are tight/);
  assert.match(copy, /GitHub REST API rate limits/);
  assert.match(copy, /Help/);
  assert.match(copy, /Feedback/);
  assert.match(copy, /GitHub API limits/);
  assert.match(copy, /REST\/core/);
  assert.match(copy, /Search limits/);
  assert.match(copy, /primary limits only/);
  assert.match(copy, /Secondary limits can still happen/);
  assert.match(copy, /not directly exposed by GitHub/);
  assert.match(copy, /Do not paste GitHub tokens or private data/);
  assert.match(mainJs, /No review reminders right now\./);
  assert.match(mainJs, /Contribution preferences/);
  assert.match(mainJs, /Save preferences/);
  assert.match(mainJs, /Reset preferences/);
  assert.match(mainJs, /Learned feedback/);
  assert.match(mainJs, /Reset learned feedback/);
  assert.doesNotMatch(indexHtml, /aria-disabled="true" disabled/);
  assert.doesNotMatch(indexHtml, />\s*JD\s*</);
});

test('match score v3 UI exposes compact confidence and inspector diagnostics', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const resultCards = sliceBetween(mainJs, 'function renderIssueCardsList', 'function bindIssueCardListEvents');
  const inspector = sliceBetween(mainJs, 'function openInspector', 'function closeInspector');

  assert.match(resultCards, /% Match/);
  assert.match(resultCards, /Fit:/);
  assert.match(resultCards, /Confidence:/);
  assert.match(inspector, /Score diagnostics/);
  assert.match(inspector, /Confidence/);
  assert.match(inspector, /Mini-scores/);
  assert.match(inspector, /Opportunity Fit/);
  assert.match(inspector, /Issue Clarity/);
  assert.match(inspector, /Repo Health/);
  assert.match(inspector, /Social Risk/);
  assert.match(inspector, /Setup Ease/);
  assert.match(inspector, /Personal Fit/);
  assert.match(inspector, /Why this score\?/);
});

test('profile preferences UI does not auto-apply search filters', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const profile = sliceBetween(mainJs, 'function renderProfile(container)', 'function hiddenItemMatchesFilter');

  assert.match(profile, /contribution-preferences-form/);
  assert.match(mainJs, /profile-preferences-save-btn/);
  assert.match(profile, /profile-preferences-reset-btn/);
  assert.doesNotMatch(profile, /runGitHubSearch|performSearch|applyDraftFilters|setFilters/);
});

test('profile learned feedback summary exposes reset without private data wording', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainJs, /renderMatchFeedbackCard/);
  assert.match(mainJs, /Saved to board/);
  assert.match(mainJs, /Moved to Merged/);
  assert.match(mainJs, /Hidden issue/);
  assert.match(mainJs, /Hidden repo/);
  assert.doesNotMatch(mainJs, /private repo data|tokens in feedback|full issue body/i);
});

test('inspector comment enrichment exposes loading and error states without card fetching', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const matchScoreJs = readFileSync(new URL('../src/matchScore.js', import.meta.url), 'utf8');
  const resultCards = sliceBetween(mainJs, 'function renderIssueCardsList', 'function bindIssueCardListEvents');
  const inspector = sliceBetween(mainJs, 'function openInspector', 'function closeInspector');

  assert.match(mainJs, /Inspecting comments/);
  assert.match(mainJs, /Comment enrichment unavailable/);
  assert.match(mainJs, /Comments inspected/);
  assert.match(matchScoreJs, /Maintainer appears open to PRs/);
  assert.match(matchScoreJs, /Comment thread suggests someone may be working on this/);
  assert.match(inspector, /commentEnrichmentHTML/);
  assert.doesNotMatch(resultCards, /fetchIssueCommentsEnrichment|ensureInspectorCommentEnrichment|Inspecting comments/);
});

test('inspector advanced enrichment stays off result cards', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const resultCards = sliceBetween(mainJs, 'function renderIssueCardsList', 'function bindIssueCardListEvents');
  const inspector = sliceBetween(mainJs, 'function openInspector', 'function closeInspector');

  assert.match(mainJs, /Advanced context/);
  assert.match(mainJs, /Timeline inspected/);
  assert.match(mainJs, /Setup files inspected/);
  assert.match(mainJs, /Repo history inspected/);
  assert.match(inspector, /advancedEnrichmentHTML/);
  assert.doesNotMatch(resultCards, /fetchIssueTimelineEnrichment|fetchRepoSetupEnrichment|fetchRepoHistoryEnrichment|Advanced context/);
});

test('help and feedback routes are included in navigation setup', () => {
  const { indexHtml, mainJs } = readCopySources();

  for (const navId of [
    'tab-help',
    'tab-feedback',
    'mobile-tab-help',
    'mobile-tab-feedback'
  ]) {
    assert.match(indexHtml, new RegExp(`id="${navId}"`));
    assert.match(mainJs, new RegExp(`['"]${navId}['"]`));
  }
});

test('interactive chrome uses app tooltips instead of native title attributes', () => {
  const { indexHtml, mainJs } = readCopySources();

  assert.doesNotMatch(indexHtml, /\stitle=["'][^"']*["']/);
  assert.doesNotMatch(mainJs, /\.title\s*=/);
  assert.doesNotMatch(mainJs, /\stitle=["'][^"']*["']/);
  assert.match(indexHtml, /data-tooltip="Review reminders"/);
  assert.match(indexHtml, /data-tooltip="Settings"/);
  assert.match(indexHtml, /data-tooltip="Profile"/);
  assert.match(mainJs, /data-tooltip="\$\{safeColumn\}: \$\{lane\.count\}"/);
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

test('runtime profile avatar content clips inside the tooltip wrapper', () => {
  const { indexHtml, mainJs } = readCopySources();
  const avatarTag = indexHtml.match(/<div class="([^"]*)" id="user-profile-avatar"[^>]*>/);
  assert.ok(avatarTag);
  assert.doesNotMatch(avatarTag[1], /\boverflow-hidden\b/);
  assert.match(avatarTag[0], /data-tooltip="Profile"/);

  const initialsRenderer = sliceBetween(
    mainJs,
    'function renderAvatarInitialsContent',
    'function renderProfileAvatarContent'
  );
  assert.match(initialsRenderer, /rounded-full/);
  assert.match(initialsRenderer, /overflow-hidden/);

  const profileRenderer = sliceBetween(
    mainJs,
    'function renderProfileAvatarContent',
    'function renderProfileAvatarFrame'
  );
  assert.match(profileRenderer, /rounded-full/);
  assert.match(profileRenderer, /overflow-hidden/);
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
