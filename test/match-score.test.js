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
  assert.ok(result.rows.some(row => row.points > 0 && row.label === 'Beginner-friendly label with actionable details'));
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

test('match score v3 preserves old fields and adds structured preview fields', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue());

  assert.equal(typeof result.score, 'number');
  assert.equal(typeof result.rating, 'string');
  assert.ok(Array.isArray(result.rows));
  assert.ok(Array.isArray(result.passReasons));
  assert.equal(typeof result.flags.isAssigned, 'boolean');
  assert.equal(typeof result.flags.hasBeginnerLabel, 'boolean');
  assert.equal(typeof result.flags.hasStaleLabel, 'boolean');
  assert.equal(typeof result.isContributionCandidate, 'boolean');
  assert.equal(result.stage, 'preview');
  assert.equal(result.confidence.level, 'High');
  assert.ok(result.confidence.reasons.includes('Comments not inspected'));
  assert.ok(result.confidence.reasons.includes('Setup files not inspected'));
  assert.ok(result.confidence.reasons.includes('Timeline not inspected'));
  assert.deepEqual(Object.keys(result.miniScores).sort(), [
    'issueClarity',
    'opportunityFit',
    'personalFit',
    'repoHealth',
    'scope',
    'setupEase',
    'socialRisk'
  ].sort());
  assert.equal(result.personalFit.status, 'Unknown');
  assert.equal(result.personalFit.adjustment, 0);
});

test('preview advisory enrichment gaps do not make strong hydrated issues low confidence', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    title: 'Fix settings copy button aria label',
    body: [
      'Actual behavior:',
      'The settings copy button has the wrong aria label.',
      '',
      'Expected behavior:',
      'The button should announce Copy token.',
      '',
      'Proposed fix:',
      '- Update the settings copy button aria label.',
      '- Add a regression test for the accessible label.'
    ].join('\n'),
    repository: strongRepo()
  }));

  assert.equal(result.stage, 'preview');
  assert.equal(result.confidence.level, 'High');
  assert.ok(result.score > 90);
  assert.ok(result.confidence.reasons.includes('Comments not inspected'));
});

test('missing reliable score evidence lowers match score directly', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    repository: { full_name: 'openai/codex', metadataUnavailable: true }
  }));

  assert.equal(result.confidence.level, 'Low');
  assert.ok(result.confidence.reasons.includes('Repository metadata unavailable'));
  assert.ok(result.score <= 88);
  assert.ok(result.rows.some(row => row.label === 'Missing reliable score evidence'));
});

test('medium evidence risk lowers match score without a visible confidence cap', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    comments: 12,
    repository: strongRepo()
  }));

  assert.equal(result.confidence.level, 'Medium');
  assert.ok(result.score <= 94);
  assert.ok(result.rows.some(row => row.label === 'Score evidence needs review'));
  assert.ok(!result.rows.some(row => /confidence cap/i.test(row.label)));
});

test('empty template good-first issues cannot score as strong matches', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    title: 'Lab',
    body: [
      '<!-- If you have time, send us a pull request. Otherwise fill out the fields. -->',
      '## Language name',
      'Lab',
      '',
      '## URL of example repository',
      '',
      '## URL of syntax highlighting grammar',
      '',
      '## Most popular extensions',
      '',
      '## Detected language'
    ].join('\n'),
    labels: [{ name: 'Good First Issue' }],
    comments: 0,
    repository: strongRepo({
      full_name: 'github-linguist/linguist',
      stargazers_count: 13000,
      language: 'Ruby'
    })
  }));

  assert.ok(result.score < 50);
  assert.ok(result.passReasons.includes('Too vague'));
  assert.ok(result.rows.some(row => row.label === 'Unfilled issue template'));
});

test('filled issue templates are not marked unfilled just because the title is short', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    title: 'Crash on startup',
    body: [
      '## Expected behavior',
      'The app should open the dashboard after loading local storage and should keep the saved board cards visible.',
      '',
      '## Actual behavior',
      'The app crashes before the dashboard renders when a saved card contains an imported repository payload.',
      '',
      '## Steps to reproduce',
      '1. Import the attached local data payload.',
      '2. Reload the app.',
      '3. Confirm the dashboard renders without throwing.',
      '',
      '## Environment',
      'Windows 11, Chrome, local Vite dev server.'
    ].join('\n'),
    labels: [{ name: 'bug' }],
    comments: 1,
    repository: strongRepo()
  }));

  assert.ok(result.score >= 70);
  assert.ok(!result.passReasons.includes('Too vague'));
  assert.ok(!result.rows.some(row => row.label === 'Unfilled issue template'));
});

test('assigned issues are demoted even when labels and body look good', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    title: 'Fix README install command typo',
    body: [
      'Expected behavior: the README should show the correct install command.',
      'Actual behavior: it shows the old package name.',
      'Proposed fix:',
      '- Update README.md.',
      '- Add a tiny docs regression check if the repo has one.'
    ].join('\n'),
    assignee: { login: 'maintainer' },
    assignees: [{ login: 'maintainer' }],
    labels: [{ name: 'good first issue' }, { name: 'documentation' }],
    repository: strongRepo()
  }));

  assert.ok(result.score <= 69);
  assert.ok(result.passReasons.includes('Assigned'));
  assert.ok(result.rows.some(row => row.label === 'Assigned issue cap'));
});

test('selected filters change match score after apply/search intent', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');
  const { buildFinderIntent } = await import('../src/searchInteractions.js');
  const candidate = issue({
    repository: strongRepo({
      full_name: 'fullsend-ai/fullsend',
      stargazers_count: 65,
      language: 'TypeScript'
    })
  });

  const defaultIntent = buildFinderIntent({
    labels: ['good first issue', 'help wanted'],
    labelMode: 'OR',
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    unassigned: false
  });
  const highStarIntent = buildFinderIntent({
    labels: ['good first issue', 'help wanted'],
    labelMode: 'OR',
    stars: '5k+',
    comments: 'Low (0-5)',
    updatedDate: 'Last month',
    unassigned: true
  });

  const defaultScore = calculateMatchScore(candidate, { intent: defaultIntent });
  const filteredScore = calculateMatchScore(candidate, { intent: highStarIntent });

  assert.ok(defaultScore.score > filteredScore.score);
  assert.ok(filteredScore.score < 50);
  assert.ok(filteredScore.passReasons.includes('Below stars filter'));
  assert.ok(filteredScore.rows.some(row => row.label === 'Below selected repo stars cap'));
});

test('advanced difficulty labels cap inflated help-wanted matches', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');
  const { buildFinderIntent } = await import('../src/searchInteractions.js');

  const result = calculateMatchScore(issue({
    title: 'perf(rate_limit): a single global lock serializes every rate check across all keys',
    body: [
      '## Context',
      'RateLimiter guards all of its state with one asyncio.Lock. Under high concurrency this turns the limiter into a serialization point.',
      '',
      'This is a design-level change, so it is worth discussing the approach before a large PR.',
      '',
      '## What to do',
      '- Per-key locks, with a strategy for creating and reclaiming them safely.',
      '- Sharded locks to bound the number of lock objects while cutting cross-key contention.',
      '- Atomic-ish counter updates that avoid holding a lock across the whole check.',
      '',
      '## Acceptance criteria',
      '- Independent keys no longer block each other on a single global lock.',
      '- Limits remain correct under concurrent access.',
      '- A short note in the PR explains why the new scheme is race-free.'
    ].join('\n'),
    labels: [
      { name: 'good first issue' },
      { name: 'help wanted' },
      { name: 'performance' },
      { name: 'level:advanced' },
      { name: 'type:performance' }
    ],
    comments: 0,
    repository: strongRepo({
      full_name: 'Abhigyan-Shekhar/Waggle-mcp',
      stargazers_count: 6,
      forks_count: 19,
      open_issues_count: 0,
      language: 'Python'
    })
  }), {
    intent: buildFinderIntent({
      labels: ['good first issue', 'help wanted'],
      labelMode: 'OR',
      stars: 'Any',
      comments: 'Any',
      updatedDate: 'Any',
      unassigned: false
    }),
    enrichment: {
      comments: { inspected: true },
      timeline: { inspected: true },
      setup: { inspected: true, setupDocsPresent: true },
      history: { inspected: true, recentMergedPrs: true, activeSameLabelIssues: true }
    }
  });

  assert.equal(result.rating, 'Good candidate');
  assert.ok(result.score <= 84);
  assert.ok(result.passReasons.includes('Advanced difficulty'));
  assert.ok(result.rows.some(row => row.label === 'Advanced difficulty label'));
  assert.ok(result.score < 85);
  assert.equal(result.flags.difficulty, 'advanced');
  assert.equal(result.flags.hasBeginnerLabel, false);
});

test('intermediate difficulty labels cap testing issues away from perfect first-pr matches', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');
  const { buildFinderIntent } = await import('../src/searchInteractions.js');

  const result = calculateMatchScore(issue({
    title: 'test(config): cover WAGGLE_HTTP_PORT env override',
    body: [
      '## Context',
      'AppConfig reads WAGGLE_HTTP_PORT, but there is no regression coverage proving the env var wins over the default.',
      '',
      '## What to do',
      '- Add a focused test for WAGGLE_HTTP_PORT.',
      '- Keep the test isolated from the real environment.',
      '- Assert the configured HTTP port changes only for that case.',
      '',
      '## Acceptance criteria',
      '- The test fails without the override behavior.',
      '- No runtime behavior changes are required.'
    ].join('\n'),
    labels: [
      { name: 'help wanted' },
      { name: 'testing' },
      { name: 'performance' },
      { name: 'level:intermediate' },
      { name: 'type:testing' }
    ],
    comments: 0,
    repository: strongRepo({
      full_name: 'Abhigyan-Shekhar/Waggle-mcp',
      stargazers_count: 6,
      forks_count: 19,
      open_issues_count: 0,
      language: 'Python'
    })
  }), {
    intent: buildFinderIntent({
      labels: ['good first issue', 'help wanted'],
      labelMode: 'OR',
      stars: 'Any',
      comments: 'Any',
      updatedDate: 'Any',
      unassigned: false
    }),
    enrichment: {
      comments: { inspected: true },
      timeline: { inspected: true },
      setup: { inspected: true, setupDocsPresent: true },
      history: { inspected: true, recentMergedPrs: true, activeSameLabelIssues: true }
    }
  });

  assert.equal(result.rating, 'Good candidate');
  assert.equal(result.flags.difficulty, 'intermediate');
  assert.equal(result.flags.hasBeginnerLabel, false);
  assert.ok(result.score < 100);
  assert.ok(result.score <= 84);
  assert.ok(result.passReasons.includes('Intermediate difficulty'));
  assert.ok(result.rows.some(row => row.label === 'Intermediate difficulty label'));
  assert.ok(result.rows.some(row => row.label === 'Intermediate difficulty cap'));
  assert.ok(!result.rows.some(row => row.label.includes('Beginner-friendly')));
});

test('help wanted alone is availability, not beginner difficulty', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    title: 'Add regression test for CLI config loading',
    body: 'Expected behavior: the CLI should load config from the documented path. Add a focused test and keep the implementation unchanged.',
    labels: [{ name: 'help wanted' }, { name: 'testing' }],
    comments: 0,
    repository: strongRepo({ language: 'Python' })
  }));

  assert.equal(result.flags.hasBeginnerLabel, false);
  assert.equal(result.flags.difficulty, 'unknown');
  assert.ok(result.rows.some(row => row.label === 'Help wanted availability signal'));
  assert.ok(!result.rows.some(row => row.label.includes('Beginner-friendly')));
});

test('explicit beginner difficulty still allows true starter issues to score strongly', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    labels: [{ name: 'help wanted' }, { name: 'level:beginner' }, { name: 'type:docs' }],
    repository: strongRepo({ language: 'Python' })
  }));

  assert.equal(result.rating, 'Strong candidate');
  assert.equal(result.flags.difficulty, 'beginner');
  assert.equal(result.flags.hasBeginnerLabel, true);
  assert.ok(result.score >= 85);
  assert.ok(result.rows.some(row => row.label === 'Beginner-friendly label with actionable details'));
});

test('mini-scores expose all dimensions with stable labels', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue());

  assert.equal(result.miniScores.opportunityFit.label, 'High');
  assert.equal(result.miniScores.issueClarity.label, 'High');
  assert.equal(result.miniScores.scope.label, 'Small');
  assert.equal(result.miniScores.repoHealth.label, 'High');
  assert.equal(result.miniScores.socialRisk.label, 'Low risk');
  assert.equal(result.miniScores.setupEase.label, 'Unknown');
  assert.equal(result.miniScores.personalFit.label, 'Unknown');
});

test('personal fit profile adds visible preference rows and adjustment', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue(), {
    profile: {
      version: 1,
      languages: ['TypeScript'],
      preferredWork: ['docs'],
      avoidWork: [],
      experience: 'first-pr',
      timeBudget: 'half-day'
    }
  });

  assert.equal(result.personalFit.status, 'Matched');
  assert.ok(result.personalFit.adjustment > 0);
  assert.ok(result.rows.some(row => row.label === 'Matches TypeScript preference'));
  assert.ok(result.rows.some(row => row.label === 'Matches docs preference'));
});

test('personal fit penalties are visible and capped', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({
    title: 'Rewrite architecture and migrate every package',
    body: 'Expected behavior: rewrite the entire architecture across everything and migrate every package.',
    labels: [{ name: 'refactor' }, { name: 'migration' }, { name: 'api' }],
    repository: strongRepo({ language: 'JavaScript' })
  }), {
    profile: {
      version: 1,
      languages: ['TypeScript'],
      preferredWork: [],
      avoidWork: ['refactor', 'migration', 'api'],
      experience: 'first-pr',
      timeBudget: 'under-1-hour'
    }
  });

  assert.equal(result.personalFit.status, 'Mismatch');
  assert.equal(result.personalFit.adjustment, -20);
  assert.ok(result.rows.some(row => row.label === 'Matches avoided refactor work'));
  assert.ok(result.rows.some(row => row.label === 'Larger than under-1-hour preference'));
});

test('personal fit boost cannot exceed 15', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue(), {
    profile: {
      version: 1,
      languages: ['TypeScript'],
      preferredWork: ['docs', 'readme', 'config', 'test'],
      avoidWork: [],
      experience: 'first-pr',
      timeBudget: 'under-1-hour'
    }
  });

  assert.equal(result.personalFit.adjustment, 15);
});

test('closed issue remains zero when profile is present', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({ state: 'closed' }), {
    profile: {
      version: 1,
      languages: ['TypeScript'],
      preferredWork: ['docs'],
      avoidWork: [],
      experience: 'first-pr',
      timeBudget: 'under-1-hour'
    }
  });

  assert.equal(result.score, 0);
  assert.equal(result.personalFit.status, 'Unknown');
  assert.equal(result.personalFit.adjustment, 0);
  assert.equal(result.isContributionCandidate, false);
});

test('feedback adjustment adds transparent capped positive score rows', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue(), {
    feedback: {
      version: 1,
      totals: { saved: 4, working: 3, merged: 2, passed: 0, hiddenIssue: 0, hiddenRepo: 0 },
      buckets: {
        languages: { TypeScript: { saved: 4, working: 3, merged: 2 } },
        workTypes: { docs: { saved: 4, working: 3, merged: 2 }, tests: { saved: 3, merged: 2 } },
        scope: { Small: { working: 3, merged: 2 } },
        repo: { 'openai/codex': { merged: 2 } },
        labels: { 'good first issue': { working: 3, merged: 2 } }
      },
      events: {}
    }
  });

  assert.ok(result.rows.some(row => row.label === 'Matches your completed contribution patterns'));
  assert.ok(result.rows.find(row => row.label === 'Matches your completed contribution patterns').points <= 8);
});

test('feedback adjustment adds transparent capped negative score rows', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue(), {
    feedback: {
      version: 1,
      totals: { saved: 0, working: 0, merged: 0, passed: 4, hiddenIssue: 3, hiddenRepo: 2 },
      buckets: {
        languages: { TypeScript: { passed: 4, hiddenIssue: 3, hiddenRepo: 2 } },
        workTypes: { docs: { passed: 4, hiddenIssue: 3 }, tests: { hiddenIssue: 3 } },
        scope: { Small: { passed: 4 } },
        repo: { 'openai/codex': { hiddenRepo: 2 } },
        labels: { 'good first issue': { passed: 4, hiddenIssue: 3 } }
      },
      events: {}
    }
  });

  const row = result.rows.find(item => item.label === 'Similar items were passed or hidden locally');
  assert.ok(row);
  assert.ok(row.points >= -10);
});

test('closed issue remains zero with positive feedback present', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue({ state: 'closed' }), {
    feedback: {
      version: 1,
      totals: { saved: 10, working: 10, merged: 10, passed: 0, hiddenIssue: 0, hiddenRepo: 0 },
      buckets: {
        languages: { TypeScript: { merged: 10 } },
        workTypes: { docs: { merged: 10 } },
        scope: { Small: { merged: 10 } },
        repo: { 'openai/codex': { merged: 10 } },
        labels: { 'good first issue': { merged: 10 } }
      },
      events: {}
    }
  });

  assert.equal(result.score, 0);
  assert.equal(result.isContributionCandidate, false);
  assert.ok(!result.rows.some(row => /completed contribution patterns|passed or hidden/.test(row.label)));
});

test('comment enrichment adds cautious score rows and enriched confidence behavior', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue(), {
    enrichment: {
      comments: {
        inspected: true,
        maintainerEncouragement: true,
        ownershipClaim: true,
        blockedHint: true,
        botOnlyRecentActivity: false,
        reasons: [
          'Maintainer appears open to PRs',
          'Comment thread suggests someone may be working on this',
          'Comment thread suggests blocked work'
        ]
      }
    }
  });

  assert.equal(result.stage, 'enriched');
  assert.ok(!result.confidence.reasons.includes('Comments not inspected'));
  assert.ok(result.confidence.reasons.includes('Comments inspected'));
  assert.ok(result.rows.some(row => row.label === 'Maintainer appears open to PRs'));
  assert.ok(result.rows.some(row => row.label === 'Comment thread suggests someone may be working on this'));
  assert.ok(result.rows.some(row => row.label === 'Comment thread suggests blocked work'));
  assert.equal(result.miniScores.socialRisk.label, 'High risk');
});

test('bot-only comment enrichment stays advisory without maintainer boost', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(issue(), {
    enrichment: {
      comments: {
        inspected: true,
        maintainerEncouragement: false,
        ownershipClaim: false,
        blockedHint: false,
        botOnlyRecentActivity: true,
        reasons: ['Only bot comments inspected']
      }
    }
  });

  assert.ok(result.confidence.reasons.includes('Only bot comments inspected'));
  assert.ok(!result.rows.some(row => row.label === 'Maintainer appears open to PRs'));
});

test('advanced enrichment updates cautious score rows and mini-scores', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug(), {
    enrichment: {
      timeline: {
        inspected: true,
        linkedPullRequest: true,
        assignmentActivity: true,
        reasons: ['Timeline shows linked PR activity', 'Timeline shows assignment activity']
      },
      setup: {
        inspected: true,
        setupDocsPresent: true,
        contributingPresent: true,
        workflowPresent: true,
        configHintsPresent: true,
        testHintsPresent: true,
        setupUnclear: false,
        reasons: ['Setup docs found', 'CI workflow found', 'Test/build hints found']
      },
      history: {
        inspected: true,
        recentMergedPrs: true,
        activeSameLabelIssues: true,
        staleSameLabelSample: false,
        reasons: ['Recent repo PRs are merging', 'Same-label issues are active']
      }
    }
  });

  const rowText = result.rows.map(row => row.label).join(' ');

  assert.match(rowText, /Timeline shows linked PR activity/);
  assert.match(rowText, /Timeline shows assignment activity/);
  assert.match(rowText, /Repo setup files look discoverable/);
  assert.match(rowText, /Recent repo PRs are merging/);
  assert.match(rowText, /Same-label issues are active/);
  assert.equal(result.miniScores.setupEase.level, 'High');
  assert.match(result.miniScores.socialRisk.reasons.join(' '), /Timeline shows linked PR activity/);
  assert.match(result.confidence.reasons.join(' '), /Timeline inspected/);
  assert.match(result.confidence.reasons.join(' '), /Setup files inspected/);
});

test('known platform mismatch becomes a likely pass only when target platforms exclude support', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const mismatch = calculateMatchScore(clearBug(), {
    targetPlatforms: ['windows'],
    enrichment: {
      setup: {
        inspected: true,
        setupDocsPresent: true,
        contributingPresent: true,
        workflowPresent: false,
        configHintsPresent: true,
        testHintsPresent: true,
        setupUnclear: false,
        platformSupport: { linux: true },
        platformUnsupported: { windows: true },
        reasons: ['Linux setup supported', 'Windows is not supported']
      }
    }
  });
  const compatible = calculateMatchScore(clearBug(), {
    targetPlatforms: ['linux', 'windows'],
    enrichment: mismatch.miniScores ? {
      setup: {
        inspected: true,
        setupDocsPresent: true,
        contributingPresent: true,
        workflowPresent: false,
        configHintsPresent: true,
        testHintsPresent: true,
        setupUnclear: false,
        platformSupport: { linux: true },
        platformUnsupported: { windows: true },
        reasons: ['Linux setup supported', 'Windows is not supported']
      }
    } : {}
  });

  assert.equal(mismatch.isContributionCandidate, false);
  assert.match(mismatch.passReasons.join(' '), /Platform mismatch/);
  assert.match(mismatch.rows.map(row => row.label).join(' '), /Target platform mismatch/);
  assert.equal(mismatch.miniScores.setupEase.label, 'Blocked');
  assert.equal(compatible.isContributionCandidate, true);
});

test('support-only platform mismatch blocks unchecked-only platform support', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');

  const result = calculateMatchScore(clearBug(), {
    targetPlatforms: ['windows'],
    enrichment: {
      setup: {
        inspected: true,
        setupDocsPresent: true,
        contributingPresent: true,
        workflowPresent: false,
        configHintsPresent: true,
        testHintsPresent: true,
        setupUnclear: false,
        platformSupport: { linux: true },
        platformUnsupported: {},
        reasons: ['Linux setup supported']
      }
    }
  });
  const rowText = result.rows.map(row => row.label).join(' ');
  const setupText = result.miniScores.setupEase.reasons.join(' ');

  assert.equal(result.isContributionCandidate, false);
  assert.match(rowText, /Target platform mismatch/);
  assert.match(setupText, /Windows/);
  assert.equal(result.miniScores.setupEase.label, 'Blocked');
});

test('confirmed selected platform support gets a small score boost', async () => {
  const { calculateMatchScore } = await import('../src/matchScore.js');
  const baseIssue = issue({
    title: 'Fix parser option',
    body: 'Expected behavior: parser should respect the option when present.',
    labels: [{ name: 'bug' }],
    comments: 1,
    assignee: null,
    assignees: [],
    updated_at: new Date().toISOString(),
    repository: strongRepo({ stargazers_count: 1, open_issues_count: 3 })
  });
  const neutral = calculateMatchScore(baseIssue, {
    targetPlatforms: ['linux'],
    enrichment: {
      setup: {
        inspected: true,
        setupDocsPresent: true,
        contributingPresent: false,
        workflowPresent: false,
        configHintsPresent: false,
        testHintsPresent: false,
        setupUnclear: false,
        platformSupport: {},
        platformUnsupported: {},
        reasons: ['Setup docs found']
      }
    }
  });
  const confirmed = calculateMatchScore(baseIssue, {
    targetPlatforms: ['linux'],
    enrichment: {
      setup: {
        inspected: true,
        setupDocsPresent: true,
        contributingPresent: false,
        workflowPresent: false,
        configHintsPresent: false,
        testHintsPresent: false,
        setupUnclear: false,
        platformSupport: { linux: true },
        platformUnsupported: {},
        reasons: ['Linux setup supported']
      }
    }
  });

  assert.equal(confirmed.score, neutral.score + 3);
  assert.match(confirmed.rows.map(row => row.label).join(' '), /Selected platform confirmed/);
  assert.doesNotMatch(neutral.rows.map(row => row.label).join(' '), /Selected platform confirmed/);
});
