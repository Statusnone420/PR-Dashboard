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

function strongRepo(overrides = {}) {
  return {
    full_name: 'openai/codex',
    stargazers_count: 84000,
    forks_count: 12000,
    open_issues_count: 4000,
    pushed_at: new Date().toISOString(),
    archived: false,
    disabled: false,
    language: 'Rust',
    ...overrides
  };
}

function clearBug(overrides = {}) {
  return issue({
    title: 'Context menu still shows English labels',
    body: [
      'Actual behavior:',
      'The menu still shows Undo, Redo, Copy, Paste, Delete, and Select All in English.',
      '',
      'Expected behavior:',
      'After selecting Chinese, the app menu and context menu should be localized.',
      '',
      'Steps to reproduce:',
      '1. Open the app.',
      '2. Go to Settings > General > Language.',
      '3. Select Chinese.',
      '4. Open the app menu.'
    ].join('\n'),
    labels: [{ name: 'bug' }, { name: 'app' }],
    comments: 1,
    assignee: null,
    assignees: [],
    updated_at: new Date().toISOString(),
    repository: strongRepo(),
    ...overrides
  });
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

test('bare bug label does not bypass near perfect gate', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug());

  assert.ok(result.score <= 90);
  assert.ok(!result.rows.some(row => row.label === 'Clear task list'));
  assert.ok(!result.rows.some(row => row.label === 'Small docs/config cleanup scope'));
});

test('bug with clear repro but no bounded fix does not hit near perfect', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug({
    body: [
      'Actual behavior:',
      'Clicking Copy to clipboard fails in the settings menu.',
      '',
      'Expected behavior:',
      'The command should copy the token value.',
      '',
      'Steps to reproduce:',
      '1. Open settings.',
      '2. Click copy to clipboard.'
    ].join('\n')
  }));

  assert.ok(result.score <= 90);
  assert.ok(!result.rows.some(row => row.label === 'Small docs/config cleanup scope'));
});

test('bug with clear repro and bounded fix can bypass near perfect gate', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug({
    title: 'Fix settings copy button aria label',
    body: [
      'Actual behavior:',
      'The settings copy button has the wrong aria label.',
      '',
      'Expected behavior:',
      'The button should announce Copy token.',
      '',
      'Steps to reproduce:',
      '1. Open settings.',
      '2. Inspect the copy button.',
      '',
      'Proposed fix:',
      '- Update the settings copy button aria label.',
      '- Add a regression test for the accessible label.'
    ].join('\n')
  }));

  assert.equal(result.rating, 'Strong candidate');
  assert.ok(result.score > 90);
});

test('copy paste UI text does not count as copywriting scope', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug());

  assert.ok(!result.rows.some(row => row.label === 'Small docs/config cleanup scope'));
});

test('copy to clipboard does not count as copywriting scope', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug({
    body: 'Expected behavior: the Copy to clipboard button should copy the generated command.\nActual behavior: it does nothing.'
  }));

  assert.ok(!result.rows.some(row => row.label === 'Small docs/config cleanup scope'));
});

test('UI or error message copy can count as scoped content', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug({
    title: 'Improve error message copy for invalid token',
    body: 'Expected behavior: invalid token errors should use clearer UI copy.\nActual behavior: the current error message copy is vague.'
  }));

  assert.ok(result.rows.some(row => row.label === 'Small docs/config cleanup scope'));
});

test('repro steps do not count as task list', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug());

  assert.ok(!result.rows.some(row => row.label === 'Clear task list'));
});

test('template checklist does not count as task list', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug({
    body: [
      'Expected behavior: the app should show the localized menu.',
      '',
      '- [x] I searched existing issues',
      '- [x] I have read the contributing guide',
      '- [x] I am using the latest version'
    ].join('\n')
  }));

  assert.ok(!result.rows.some(row => row.label === 'Clear task list'));
});

test('action oriented markdown checklist counts as task list', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug({
    body: [
      'Expected behavior: the command should parse quoted paths.',
      '',
      'Tasks:',
      '- [ ] Add failing parser test.',
      '- [ ] Update parser behavior.',
      '- [ ] Document the option.'
    ].join('\n')
  }));

  assert.ok(result.rows.some(row => row.label === 'Clear task list'));
});

test('generic repo health and freshness cannot produce near perfect score', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug({
    title: 'Settings panel renders incorrect text',
    body: 'Actual behavior: settings panel renders incorrect text. Expected behavior: settings panel should render correct text.'
  }));

  assert.ok(result.score <= 90);
});

test('broad well described bug can still be strong but not fake perfect', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug({
    title: 'Fix broken settings validation error message',
    body: [
      'Actual behavior:',
      'Saving an invalid token shows an empty validation error message.',
      '',
      'Expected behavior:',
      'The settings form should show a clear error message copy explaining that the token is invalid.',
      '',
      'Proposed fix:',
      '- Update the validation error message copy.',
      '- Add a regression test for invalid token feedback.'
    ].join('\n')
  }));

  assert.equal(result.rating, 'Strong candidate');
  assert.ok(result.score > 90);
  assert.ok(result.score < 100);
});
