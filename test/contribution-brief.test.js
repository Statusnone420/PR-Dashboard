import test from 'node:test';
import assert from 'node:assert/strict';

const NOW = Date.parse('2026-05-21T12:00:00Z');

function activeRepo(overrides = {}) {
  return {
    full_name: 'openai/codex',
    stargazers_count: 1200,
    forks_count: 130,
    open_issues_count: 42,
    pushed_at: '2026-05-10T12:00:00Z',
    archived: false,
    disabled: false,
    language: 'TypeScript',
    ...overrides
  };
}

function issue(overrides = {}) {
  return {
    state: 'open',
    title: 'Fix README typo in install command',
    body: 'Expected behavior: the README should show the correct npm command.\n- [ ] Update docs\n- [ ] Confirm command name',
    labels: [{ name: 'good first issue' }],
    comments: 2,
    assignee: null,
    assignees: [],
    updated_at: '2026-05-20T12:00:00Z',
    repository: activeRepo(),
    ...overrides
  };
}

async function briefFor(issueInput) {
  const { calculateMatchScore } = await import('../src/matchScore.js');
  const { buildContributionBrief } = await import('../src/contributionBrief.js');
  return buildContributionBrief(issueInput, calculateMatchScore(issueInput, { now: NOW }), { now: NOW });
}

test('good first issue with low comments and active repo is a first PR good candidate', async () => {
  const brief = await briefFor(issue());

  assert.equal(brief.verdict, 'Good candidate');
  assert.equal(brief.bestFor, 'First PR');
  assert.equal(brief.scope, 'Small scope');
  assert.equal(brief.clarity, 'Clear enough');
  assert.equal(brief.socialRisk, 'Low noise');
  assert.ok(brief.repoHealth.includes('Active'));
  assert.equal(brief.guidanceFit, 'Well-bounded');
  assert.ok(brief.why.length >= 2 && brief.why.length <= 3);
});

test('unassigned clear bug without beginner label is standard', async () => {
  const brief = await briefFor(issue({
    title: 'Fix crash when workspace path contains spaces',
    body: 'Steps to reproduce: create a workspace path with spaces and run npm test. Expected behavior: the command should complete. Actual behavior: it crashes while resolving the path.',
    labels: [{ name: 'bug' }],
    comments: 3
  }));

  assert.equal(brief.verdict, 'Good candidate');
  assert.equal(brief.bestFor, 'Standard');
  assert.equal(brief.clarity, 'Clear enough');
  assert.equal(brief.guidanceFit, 'Well-bounded');
});

test('complex rewrite issue is treated as a deep dive maybe', async () => {
  const brief = await briefFor(issue({
    title: 'Rewrite the renderer architecture',
    body: 'Expected behavior: the renderer should support plugins after a large refactor. The change spans state, routing, and rendering internals and needs repo inspection before choosing an implementation path.',
    labels: [{ name: 'refactor' }],
    comments: 4
  }));

  assert.equal(brief.verdict, 'Maybe');
  assert.equal(brief.bestFor, 'Deep Dive');
  assert.equal(brief.scope, 'Large/unclear scope');
  assert.equal(brief.guidanceFit, 'Needs repo inspection');
  assert.ok(brief.risks.some(risk => /scope|refactor|rewrite/i.test(risk)));
});

test('assigned high-comment stale issue is a likely pass with concrete risk reasons', async () => {
  const brief = await briefFor(issue({
    title: 'Fix intermittent release failure',
    body: 'Expected behavior: releases should publish reliably. Actual behavior: several maintainers are discussing failures across environments and the next action is still disputed.',
    labels: [{ name: 'bug' }],
    comments: 28,
    assignee: { login: 'maintainer' },
    assignees: [{ login: 'maintainer' }],
    updated_at: '2024-01-01T12:00:00Z',
    repository: activeRepo({ pushed_at: '2024-01-01T12:00:00Z' })
  }));

  assert.equal(brief.verdict, 'Likely pass');
  assert.equal(brief.bestFor, 'Skip');
  assert.ok(brief.risks.some(risk => /assigned/i.test(risk)));
  assert.ok(brief.risks.some(risk => /comment|thread/i.test(risk)));
  assert.ok(brief.risks.some(risk => /stale|old|inactive/i.test(risk)));
});

test('assigned issues are not promoted as first PR good candidates', async () => {
  const brief = await briefFor(issue({
    assignee: { login: 'maintainer' },
    assignees: [{ login: 'maintainer' }]
  }));

  assert.equal(brief.verdict, 'Maybe');
  assert.notEqual(brief.bestFor, 'First PR');
  assert.equal(brief.socialRisk, 'Already assigned');
});

test('vague issue asks maintainer first instead of pretending it is ready', async () => {
  const brief = await briefFor(issue({
    title: 'Improve onboarding',
    body: 'This should be better but details are unclear.',
    labels: [{ name: 'good first issue' }],
    comments: 1
  }));

  assert.equal(brief.verdict, 'Maybe');
  assert.equal(brief.clarity, 'Needs clarification');
  assert.equal(brief.guidanceFit, 'Ask maintainer first');
  assert.match(brief.maintainerQuestion, /\?$/);
});

test('metadata wording does not trigger meta hard-pass detection', async () => {
  const input = issue({
    title: 'Fix metadata export for workspace settings',
    body: 'Steps to reproduce: export workspace settings with metadata enabled. Expected behavior: metadata values should be preserved. Actual behavior: one field is omitted from the export.',
    labels: [{ name: 'bug' }, { name: 'metadata' }],
    comments: 2
  });
  const { calculateMatchScore } = await import('../src/matchScore.js');
  const scoreData = calculateMatchScore(input, { now: NOW });
  const { buildContributionBrief } = await import('../src/contributionBrief.js');
  const brief = buildContributionBrief(input, scoreData, { now: NOW });

  assert.ok(scoreData.score >= 70);
  assert.notEqual(brief.verdict, 'Likely pass');
  assert.equal(brief.bestFor, 'Standard');
  assert.doesNotMatch(brief.risks.join(' '), /meta work/i);
});

test('likely-pass why copy does not call a high score below the bar', async () => {
  const { buildContributionBrief } = await import('../src/contributionBrief.js');
  const brief = buildContributionBrief(issue({
    labels: [{ name: 'blocked' }],
    title: 'Fix focused install docs',
    body: 'Expected behavior: install docs should show the current command. Actual behavior: the command is out of date and should be updated in one README section.'
  }), {
    score: 100,
    rows: [{ points: 100, label: 'Strong match' }],
    passReasons: [],
    flags: { hasBeginnerLabel: true }
  }, { now: NOW });

  assert.equal(brief.verdict, 'Likely pass');
  assert.equal(brief.bestFor, 'Skip');
  assert.doesNotMatch(brief.why.join(' '), /below the usual contribution bar/i);
  assert.match(brief.why.join(' '), /blocked|label/i);
});
