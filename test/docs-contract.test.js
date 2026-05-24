import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function readRepoFile(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

test('active plan is reset with archive pointers for completed work', () => {
  const plan = readRepoFile('PLAN.md');

  assert.match(plan, /No active implementation plan is currently in progress/);
  assert.match(plan, /docs\/archive\/2026-05-23-match-score-full-system-implementation-plan\.md/);
  assert.match(plan, /Ready for the next UX sweep plan/);
  assert.equal(existsSync(resolve(root, 'docs/archive/2026-05-23-match-score-full-system-implementation-plan.md')), true);
});

test('state handoff stays compact and records the scan-line implementation', () => {
  const state = readRepoFile('STATE.md');

  assert.ok(state.length < 12000, 'STATE.md should stay compact after archiving history');
  assert.match(state, /Advanced Context Scan-Line Loading/);
  assert.match(state, /minimum 300ms loading display/);
  assert.match(state, /Fetching timeline/);
  assert.match(state, /Scanning setup files/);
  assert.match(state, /Reading repo history/);
  assert.equal(existsSync(resolve(root, 'docs/archive/2026-05-23-state-history.md')), true);
});

test('README documents current Match Score and Advanced Context behavior', () => {
  const readme = readRepoFile('README.md');

  assert.match(readme, /Advanced Context/);
  assert.match(readme, /scan-line loading cards/);
  assert.match(readme, /confidence, mini-scores, local preferences, and learned feedback/);
  assert.match(readme, /pr_dashboard_score_enrichment_cache_v1/);
  assert.match(readme, /GitHub tokens, repo metadata cache, and score enrichment cache are never exported/);
});

test('security and data-model docs describe enrichment cache and export boundaries', () => {
  const security = readRepoFile('docs/SECURITY.md');
  const dataModel = readRepoFile('docs/DATA_MODEL.md');

  for (const doc of [security, dataModel]) {
    assert.match(doc, /pr_dashboard_contribution_preferences_v1/);
    assert.match(doc, /pr_dashboard_match_feedback_v1/);
    assert.match(doc, /pr_dashboard_score_enrichment_cache_v1/);
    assert.match(doc, /score enrichment cache/i);
  }

  assert.match(security, /Opening an issue inspector can send read-only enrichment requests/);
  assert.match(security, /Private repositories are not cached/);
  assert.doesNotMatch(security, /Finder v2/);
  assert.match(dataModel, /comments, timeline events, repo setup files, recent closed pull requests, and same-label issue history/);
  assert.match(dataModel, /The Advanced Context inspector cards use a visual loading state/);
});
