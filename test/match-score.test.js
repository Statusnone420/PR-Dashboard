import test from 'node:test';
import assert from 'node:assert/strict';

function issue(overrides = {}) {
  return {
    state: 'open',
    title: 'Fix README typo in install command',
    body: 'Expected behavior: the README should show the correct npm command.\n- [ ] Update docs\n- [ ] Confirm command name',
    labels: [{ name: 'good first issue' }],
    comments: 2,
    assignee: null,
    assignees: [],
    updated_at: new Date().toISOString(),
    repository: {
      full_name: 'openai/codex',
      stargazers_count: 1200,
      forks_count: 100,
      open_issues_count: 40,
      pushed_at: new Date().toISOString(),
      archived: false,
      disabled: false,
      language: 'TypeScript'
    },
    ...overrides
  };
}

test('closed issues always score zero', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({ state: 'closed' }));

  assert.equal(result.score, 0);
  assert.equal(result.rating, 'Risky / likely pass');
  assert.match(result.rows.map(row => row.label).join(' '), /Closed issue/);
});

test('clear beginner docs issues score as strong candidates with signed breakdown rows', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue());

  assert.equal(result.rating, 'Strong candidate');
  assert.ok(result.score >= 85);
  assert.ok(result.rows.some(row => row.points > 0 && row.label === 'Beginner-friendly label'));
  assert.ok(result.rows.every(row => Number.isInteger(row.points)));
});

test('meta and growth issues are penalized and receive pass reason chips', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    title: 'Grow to 1000 stars with starter issues board',
    body: 'This roadmap is about community onboarding and contributors wanted. The project is bigger than me.',
    comments: 32,
    updated_at: '2024-01-01T00:00:00Z'
  }));

  assert.ok(result.score < 50);
  assert.ok(result.passReasons.includes('Meta/growth issue'));
  assert.ok(result.passReasons.includes('Too many comments'));
});

test('assigned stale complex issues expose relevant pass chips', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    title: 'Rewrite the entire renderer architecture',
    body: 'We need a broad refactor across everything. Details are unclear.',
    labels: [{ name: 'blocked' }],
    comments: 18,
    assignee: { login: 'maintainer' },
    assignees: [{ login: 'maintainer' }],
    updated_at: '2024-01-01T00:00:00Z',
    repository: {
      full_name: 'openai/codex',
      pushed_at: '2024-01-01T00:00:00Z',
      archived: false,
      disabled: false
    }
  }));

  assert.ok(result.passReasons.includes('Assigned'));
  assert.ok(result.passReasons.includes('Too old'));
  assert.ok(result.passReasons.includes('Too complex'));
});
