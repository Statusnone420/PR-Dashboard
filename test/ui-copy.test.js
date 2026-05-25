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

function assertSourceOrder(source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.notEqual(firstIndex, -1, `Missing source marker: ${first}`);
  assert.notEqual(secondIndex, -1, `Missing source marker: ${second}`);
  assert.ok(
    firstIndex < secondIndex,
    `Expected ${first} before ${second}`
  );
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

  assert.match(tokenInput, /type="password"/);
  assert.doesNotMatch(tokenInput, /type="text"/);
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
  assert.doesNotMatch(styles, /-webkit-text-security/);
  assert.match(settings, /patInput\.dataset\.tokenVisible/);
  assert.match(settings, /patInput\.type = 'text'/);
  assert.match(settings, /patInput\.type = 'password'/);
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
  assert.match(resultCards, /Why:/);
  assert.match(resultCards, /Confidence:/);
  assert.doesNotMatch(inspector, /Score diagnostics/);
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

test('inspector source order keeps decision brief before evidence and action plan', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const inspector = sliceBetween(mainJs, 'function openInspector', 'function closeInspector');
  const actionStrip = sliceBetween(
    inspector,
    '<!-- inspector-section:action-center -->',
    '<!-- Scrollable Content Viewport -->'
  );
  const scrollContent = sliceBetween(
    inspector,
    '<!-- Scrollable Content Viewport -->',
    '<!-- inspector-section:alerts -->'
  );
  const evidence = sliceBetween(
    inspector,
    '<!-- inspector-section:score-evidence -->',
    '<!-- inspector-section:action-plan -->'
  );

  assertSourceOrder(inspector, '<!-- inspector-section:action-center -->', '<!-- inspector-section:alerts -->');
  assertSourceOrder(inspector, '<!-- Inspector Title Header -->', '<!-- inspector-section:action-center -->');
  assertSourceOrder(inspector, '<!-- inspector-section:action-center -->', '<!-- Scrollable Content Viewport -->');
  assertSourceOrder(inspector, '<!-- inspector-section:alerts -->', '<!-- inspector-section:advanced-context -->');
  assertSourceOrder(inspector, '<!-- inspector-section:advanced-context -->', '${advancedEnrichmentHTML}');
  assertSourceOrder(inspector, '${advancedEnrichmentHTML}', '<!-- inspector-section:comment-enrichment -->');
  assertSourceOrder(inspector, '<!-- inspector-section:comment-enrichment -->', '${commentEnrichmentHTML}');
  assertSourceOrder(inspector, '${commentEnrichmentHTML}', 'Contribution Brief');
  assertSourceOrder(inspector, '<!-- inspector-section:contribution-brief -->', 'Contribution Brief');
  assertSourceOrder(inspector, 'Contribution Brief', 'Issue Description');
  assertSourceOrder(inspector, '<!-- inspector-section:issue-description -->', 'Issue Description');
  assertSourceOrder(inspector, 'Issue Description', '<!-- inspector-section:score-evidence -->');
  assertSourceOrder(inspector, '<!-- inspector-section:score-evidence -->', '<!-- inspector-section:action-plan -->');
  assertSourceOrder(inspector, '<!-- inspector-section:score-evidence -->', 'Action Plan');

  assert.match(evidence, /Why this score\?/);
  assert.match(evidence, /Confidence/);
  assert.match(evidence, /Mini-scores/);
  assert.match(evidence, /\$\{confidenceReasonsHTML\}/);
  assert.match(evidence, /\$\{miniScoresHTML\}/);
  assert.match(evidence, /\$\{fitScoreReasonsHTML\}/);
  assert.match(evidence, /\$\{passChipsHTML\}/);
  assert.doesNotMatch(evidence, /Score diagnostics/);
  assert.match(actionStrip, /action-toolbar/);
  assert.match(actionStrip, /Refresh this card/);
  assert.doesNotMatch(scrollContent, /action-toolbar|Refresh this card|Open on GitHub/);
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
  assert.match(mainJs, /Fetching timeline/);
  assert.match(mainJs, /Scanning setup files/);
  assert.match(mainJs, /Reading repo history/);
  assert.match(mainJs, /ADVANCED_CONTEXT_MIN_LOADING_MS\s*=\s*1200/);
  assert.match(mainJs, /advanced-context-grid/);
  assert.match(mainJs, /Timeline inspected/);
  assert.match(mainJs, /Setup files inspected/);
  assert.match(mainJs, /Repo history inspected/);
  assert.match(mainJs, /scanDelay:\s*'0s'/);
  assert.match(mainJs, /scanDelay:\s*'0\.4s'/);
  assert.match(mainJs, /scanDelay:\s*'0\.8s'/);
  assert.match(mainJs, /fadeDelay:\s*'0s'/);
  assert.match(mainJs, /fadeDelay:\s*'0\.1s'/);
  assert.match(mainJs, /fadeDelay:\s*'0\.2s'/);
  assert.match(inspector, /advancedEnrichmentHTML/);
  assert.doesNotMatch(resultCards, /fetchIssueTimelineEnrichment|fetchRepoSetupEnrichment|fetchRepoHistoryEnrichment|Advanced context/);
});

test('inspector refresh forces advanced context loading to replay', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const resetHelper = sliceBetween(mainJs, 'function resetAdvancedContextLoadingForIssue', 'function clearInspectorEnrichmentStates');
  const refreshHandler = sliceBetween(mainJs, "refreshCardBtn.addEventListener('click'", 'const inspectorMarkReviewedBtn');
  const successRefresh = sliceBetween(refreshHandler, 'const updatedCard', '} catch');

  assert.match(resetHelper, /force\s*=\s*false/);
  assert.match(resetHelper, /activeAdvancedContextIssueKey === key && !force/);
  assert.match(mainJs, /inspectorAdvancedContextRefreshPendingKey/);
  assert.match(mainJs, /if \(inspectorAdvancedContextRefreshPendingKey === key\) return/);
  assert.match(refreshHandler, /resetAdvancedContextLoadingForIssue\(issue,\s*\{\s*force:\s*true\s*\}\)/);
  assert.match(successRefresh, /resetAdvancedContextLoadingForIssue\(updatedCard,\s*\{\s*force:\s*true\s*\}\)/);
  assertSourceOrder(refreshHandler, "inspectorRefreshStatus = 'Checking GitHub...'", 'resetAdvancedContextLoadingForIssue(issue, { force: true });');
  assertSourceOrder(refreshHandler, 'resetAdvancedContextLoadingForIssue(issue, { force: true });', 'openInspector()');
  assertSourceOrder(refreshHandler, "inspectorRefreshStatus = 'Checking GitHub...'", 'openInspector()');
  assertSourceOrder(successRefresh, 'store.setInspectedIssue(updatedCard);', 'resetAdvancedContextLoadingForIssue(updatedCard, { force: true });');
  assertSourceOrder(successRefresh, 'resetAdvancedContextLoadingForIssue(updatedCard, { force: true });', 'openInspector()');
});

test('inspector resize chrome is wired without changing storage or API contracts', () => {
  const { indexHtml, mainJs } = readCopySources();
  const inspector = sliceBetween(mainJs, 'function openInspector', 'function closeInspector');

  assert.match(indexHtml, /xl:w-\[44%\]\s+2xl:w-\[40%\]/);
  assert.match(mainJs, /attachResize/);
  assert.match(mainJs, /inspectorResizeDetach/);
  assert.match(mainJs, /inspectorTitleResizeObserver/);
  assert.match(mainJs, /--inspector-title-height/);
  assert.match(inspector, /data-inspector-title-header/);
  assert.match(inspector, /class="inspector-resize-handle"/);
  assert.match(inspector, /aria-hidden="true"/);
});

test('inspector rate-limit updates accept multi-bucket enrichment snapshots', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const updater = sliceBetween(mainJs, 'function updateInspectorRateLimit', 'function rerenderInspectorForKey');

  assert.match(updater, /store\.setRateLimits\(rateLimit,\s*\{\s*notify:\s*false\s*\}\)/);
  assert.match(updater, /store\.setRateLimit\(rateLimit,\s*rateLimit\.resource \|\| 'core',\s*\{\s*notify:\s*false\s*\}\)/);
  assert.match(mainJs, /updateInspectorRateLimit\(result\.rateLimits \|\| result\.rateLimit\)/);
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

test('activity route is included in navigation setup', () => {
  const { indexHtml, mainJs } = readCopySources();

  for (const navId of [
    'tab-activity',
    'mobile-tab-activity'
  ]) {
    assert.match(indexHtml, new RegExp(`id="${navId}"`));
    assert.match(mainJs, new RegExp(`['"]${navId}['"]`));
  }
  assert.match(mainJs, /function renderActivity\(container\)/);
  assert.match(mainJs, /case 'activity'/);
});

test('profile is separated from activity and settings responsibilities', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const profile = sliceBetween(mainJs, 'function renderProfile(container)', 'function renderActivity(container)');
  const activity = sliceBetween(mainJs, 'function renderActivity(container)', 'function hiddenItemMatchesFilter');
  const settings = sliceBetween(mainJs, 'function renderSettings(container)', 'function openInspector()');

  assert.match(profile, /renderContributionPreferencesCard/);
  assert.match(profile, /Saved candidates/);
  assert.match(profile, /Active board work/);
  assert.doesNotMatch(profile, /Export Local Data/);
  assert.doesNotMatch(profile, /Import Local Data/);
  assert.doesNotMatch(profile, /Proof Log/);
  assert.doesNotMatch(profile, /Review reminders/);
  assert.doesNotMatch(profile, /Learned feedback/);

  assert.match(activity, /Proof Log/);
  assert.match(activity, /Review reminders/);
  assert.match(activity, /Personal scoring signals/);
  assert.match(activity, /renderMatchFeedbackCard/);
  assert.match(settings, /Export Local Data/);
  assert.match(settings, /Import Local Data/);
});

test('find contributions keeps exact scores while reducing card chip noise', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const resultCards = sliceBetween(mainJs, 'function renderIssueCardsList', 'function bindIssueCardListEvents');
  const inspector = sliceBetween(mainJs, 'function openInspector', 'function closeInspector');
  const finder = sliceBetween(mainJs, 'function renderFindIssues(container)', 'function renderIssueCardsList');
  const moreFilters = sliceBetween(finder, '<details class="filter-disclosure"', '</details>');

  assert.match(resultCards, /% Match/);
  assert.match(resultCards, /Confidence:/);
  assert.match(resultCards, /renderPlatformEvidenceBadge/);
  assert.match(inspector, /renderPlatformEvidenceBadge/);
  assert.match(mainJs, /platform-evidence-chip/);
  assert.match(resultCards, /\+\$\{safeInteger\(hiddenLabelCount\)\} labels/);
  assert.match(resultCards, /Why:/);
  assert.doesNotMatch(resultCards, /\.slice\(0,\s*3\)\.map/);

  assert.match(finder, /Quick filters/);
  assert.match(finder, /View GitHub query/);
  assert.match(mainJs, /pr_dashboard_find_filters_expanded_v1/);
  assert.match(finder, /More filters/);
  assert.match(finder, /filter-select/);
  assert.match(finder, /50\+/);
  assert.match(finder, /100\+/);
  assert.match(finder, /500\+/);
  assert.match(finder, /<h1 class="text-2xl[^"]*">Find your next contribution<\/h1>/);
  assert.doesNotMatch(finder, /<h1 class="text-3xl[^"]*">Find your next contribution<\/h1>/);
  assert.doesNotMatch(finder, /GitHub query preview<\/div>\s*<code/);
  assert.match(moreFilters, /Comments/);
  assert.match(moreFilters, /Updated Date/);
  assert.match(moreFilters, /Include closed issues/);
  assert.match(moreFilters, /Unassigned only/);
});

test('board exposes compact mode without importing inspector tabs', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const board = sliceBetween(mainJs, 'function renderBoard(container)', 'function getFeedbackIssueUrl');
  const inspector = sliceBetween(mainJs, 'function openInspector', 'function closeInspector');

  assert.match(mainJs, /getBoardMode/);
  assert.match(board, /Compact/);
  assert.match(board, /Full Kanban/);
  assert.match(board, /board-compact-card/);
  assert.match(board, /compact-inspect-btn/);
  assert.match(board, /Move to \$\{escapeHTML\(nextColumn\)\}/);
  assert.doesNotMatch(mainJs, /INSPECTOR_TABS/);
  assert.doesNotMatch(inspector, /role="tablist"|inspector-tab|activeInspectorTab|>\s*Overview\s*<|>\s*Evidence\s*</);
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

test('lookup and search keep hidden results out of result cards', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const cardsRenderer = sliceBetween(mainJs, 'function renderIssueCardsList', 'function bindIssueCardListEvents');
  const actionItems = sliceBetween(mainJs, 'function getSearchItemsForActions', 'function getPlatformFilterSetupScanKey');

  assert.match(actionItems, /return filterHiddenIssues\(items\)/);
  assert.doesNotMatch(actionItems, /filterVisibleIssueResults/);
  assert.match(mainJs, /const resultMode = store\.lastSearchMode \|\| store\.finderMode \|\| 'find'/);
  assert.match(mainJs, /const setupSummaryResolver = Array\.isArray\(results\) \? createPlatformFilterSetupSummaryResolver\(\) : null/);
  assert.match(mainJs, /filterVisibleIssueResults\(results, appliedFilters, \{ mode: resultMode, setupSummaryResolver \}\)/);
  assert.match(mainJs, /shouldApplyTargetPlatformResultFilter/);
  assert.match(mainJs, /getScoreTargetPlatformsForMode/);
  assert.match(mainJs, /targetPlatforms: options\.targetPlatforms \|\| getScoreTargetPlatformsForMode\(store\.filters, mode\)/);
  assert.match(mainJs, /filterHiddenIssues\(items\)\.filter/);
  assert.match(mainJs, /platformFilterSetupScanResults/);
  assert.match(mainJs, /schedulePlatformFilterSetupRerender/);
  assert.match(mainJs, /reservePlatformSetupScanBudget/);
  assert.match(mainJs, /resetPlatformFilterSetupScanBudget/);
  assert.match(mainJs, /runPlatformFilterSetupScanQueue\(budgetedCandidates, platformFilterSetupSearchRunId\)/);
  assert.match(mainJs, /DEFAULT_PLATFORM_SETUP_SCAN_CONCURRENCY/);
  assert.match(mainJs, /platformFilterSetupScanRepoResults/);
  assert.match(mainJs, /recordPlatformSetupScanFailure/);
  assert.doesNotMatch(mainJs, /platformFilterSetupScanFailures\.add\(key\)/);
  assert.doesNotMatch(mainJs, /store\.lastSearchMode === 'lookup' \? items : filterHiddenIssues\(items\)/);
  assert.doesNotMatch(mainJs, /const applyHiddenFilter = store\.lastSearchMode !== 'lookup'/);
  assert.doesNotMatch(mainJs, /hiddenCountText|hiddenResultsCount/);
  assert.doesNotMatch(cardsRenderer, /Hidden locally|unhide-card-btn|!applyHiddenFilter/);
  assert.doesNotMatch(mainJs, /Lookup can still recover this item/);
  assert.doesNotMatch(mainJs, /proof-status-chip/);
  assert.doesNotMatch(mainJs, /Proof Log status/);
  assert.doesNotMatch(mainJs, /Not in Proof Log/);
  assert.doesNotMatch(mainJs, /inspector-proof-log/);
  assert.doesNotMatch(mainJs, /proof-log-add-btn/);
  assert.doesNotMatch(mainJs, /inspector-proof-log-btn/);
  assert.doesNotMatch(mainJs, /source:\s*['"]manual_lookup['"]/);
});

test('platform badges are icon-only on result cards and independent of active filters', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const cardsRenderer = sliceBetween(mainJs, 'function renderIssueCardsList', 'function bindIssueCardListEvents');
  const badgeRenderer = sliceBetween(mainJs, 'function renderPlatformEvidenceBadge', 'function getIssueLabelNames');

  assert.match(mainJs, /getPlatformBadgeEvidence/);
  assert.match(cardsRenderer, /getPlatformBadgeEvidence\(issue, setupSummary\)/);
  assert.match(cardsRenderer, /renderPlatformEvidenceBadge\(issue\.platformEvidence\)/);
  assert.match(badgeRenderer, /if \(!evidence\?\.supportedPlatforms\?\.length\) return ''/);
  assert.match(badgeRenderer, /platform-evidence-badges/);
  assert.match(badgeRenderer, /\.map\(platform => `\s*<span class="platform-evidence-chip/);
  assert.match(badgeRenderer, /aria-label="\$\{escapeHTML\(getPlatformSupportedLabel\(platform\)\)\}"/);
  assert.doesNotMatch(badgeRenderer, /data-tooltip/);
  assert.doesNotMatch(badgeRenderer, /<span>\$\{escapeHTML\(evidence\.label\)\}<\/span>/);
  assert.doesNotMatch(badgeRenderer, /renderPlatformEvidenceIcons/);
  assert.doesNotMatch(badgeRenderer, /px-2 py-0\.5/);
});

test('mobile find contributions shows results before long filter controls', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const workspaceIndex = mainJs.indexOf('<!-- Main Workspace: Filters + Results -->');
  const resultsIndex = mainJs.indexOf('id="find-results-panel"', workspaceIndex);
  const sidebarIndex = mainJs.indexOf('id="find-issues-sidebar"', workspaceIndex);

  assert.ok(workspaceIndex > -1);
  assert.ok(resultsIndex > -1);
  assert.ok(sidebarIndex > -1);
  assert.ok(resultsIndex < sidebarIndex);
  assert.match(mainJs, /id="find-results-panel"[^>]*class="[^"]*\border-1\b[^"]*\blg:order-2\b/);
  assert.match(mainJs, /id="find-issues-sidebar"[^>]*class="[^"]*\border-2\b[^"]*\blg:order-1\b/);
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
  const actionCenter = sliceBetween(mainJs, '<!-- inspector-section:action-center -->', '<!-- Scrollable Content Viewport -->');

  assert.doesNotMatch(resultCards, /Proof Log|proof-log|proof-status|proofStatus/);
  assert.match(actionCenter, /Save issue/);
  assert.match(actionCenter, /Remove from board/);
  assert.match(actionCenter, /Hide issue/);
  assert.match(actionCenter, /Hide repo/);
  assert.match(actionCenter, /Unhide/);
  assert.match(actionCenter, /Open on GitHub/);
  assert.doesNotMatch(actionCenter, /Proof Log|proof-status-chip|proofStatus|workspace_premium/);
});

test('finder exposes target platform filters and saved actions are reversible', () => {
  const mainJs = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const finder = sliceBetween(mainJs, 'function renderFindIssues', 'function renderIssueCardsList');
  const resultCards = sliceBetween(mainJs, 'function renderIssueCardsList', 'function bindIssueCardListEvents');
  const actionCenter = sliceBetween(mainJs, '<!-- inspector-section:action-center -->', '<!-- Scrollable Content Viewport -->');

  assert.match(finder, /Target platforms/);
  assert.match(finder, /platform-filter-checkbox/);
  assert.match(resultCards, /Remove/);
  assert.match(actionCenter, /Remove from board/);
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
