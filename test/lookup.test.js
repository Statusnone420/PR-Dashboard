import test from 'node:test';
import assert from 'node:assert/strict';

test('parseExactLookupInput accepts GitHub issue URLs', async () => {
  const { parseExactLookupInput } = await import('../src/lookup.js');

  assert.deepEqual(
    parseExactLookupInput('https://github.com/openai/codex/issues/19464'),
    { owner: 'openai', repo: 'codex', number: 19464, source: 'url' }
  );
});

test('parseExactLookupInput accepts GitHub pull request URLs as issue-backed lookup references', async () => {
  const { parseExactLookupInput } = await import('../src/lookup.js');

  assert.deepEqual(
    parseExactLookupInput('https://github.com/TEAMMATES/teammates/pull/13998'),
    { owner: 'TEAMMATES', repo: 'teammates', number: 13998, source: 'pull-url', type: 'pull' }
  );
});

test('parseExactLookupInput accepts owner/repo#number references', async () => {
  const { parseExactLookupInput } = await import('../src/lookup.js');

  assert.deepEqual(
    parseExactLookupInput('openai/codex#19464'),
    { owner: 'openai', repo: 'codex', number: 19464, source: 'reference' }
  );
});

test('parseExactLookupInput accepts bare issue number only with repository context', async () => {
  const { parseExactLookupInput } = await import('../src/lookup.js');

  assert.deepEqual(
    parseExactLookupInput('#19464', { repoContext: 'openai/codex' }),
    { owner: 'openai', repo: 'codex', number: 19464, source: 'context-number' }
  );
  assert.equal(parseExactLookupInput('#19464'), null);
});

test('parseExactLookupInput rejects invalid hosts and malformed references before API calls', async () => {
  const { parseExactLookupInput } = await import('../src/lookup.js');

  assert.equal(parseExactLookupInput('https://evil.example/openai/codex/issues/1'), null);
  assert.equal(parseExactLookupInput('openai/codex#nope'), null);
  assert.equal(parseExactLookupInput('../codex#1'), null);
});

test('buildExactIssueApiUrl constructs a read-only GitHub issue endpoint', async () => {
  const { buildExactIssueApiUrl } = await import('../src/lookup.js');

  assert.equal(
    buildExactIssueApiUrl({ owner: 'openai', repo: 'codex', number: 19464 }),
    'https://api.github.com/repos/openai/codex/issues/19464'
  );
});

test('classifyLookupCandidate marks risky exact matches without blocking save', async () => {
  const { classifyLookupCandidate } = await import('../src/lookup.js');

  const result = classifyLookupCandidate({
    state: 'open',
    title: 'Roadmap for community onboarding',
    body: 'grow to 1000 stars',
    comments: 25,
    labels: [{ name: 'good first issue' }],
    repository: { full_name: 'openai/codex', pushed_at: new Date().toISOString() }
  });

  assert.equal(result.isContributionCandidate, false);
  assert.equal(result.warning, 'Not a contribution candidate');
  assert.match(result.passReasons.join(' '), /Meta\/growth issue|Too many comments/);
});
