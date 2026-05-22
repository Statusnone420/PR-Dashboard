import test from 'node:test';
import assert from 'node:assert/strict';

test('canonical issue keys are lowercased while display keys preserve repo casing', async () => {
  const { getCanonicalIssueKey, getIssueDisplayKey } = await import('../src/issueKeys.js');
  const issue = {
    number: 13997,
    repository: { full_name: 'TEAMMATES/teammates' },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13997'
  };

  assert.equal(getCanonicalIssueKey(issue), 'teammates/teammates#13997');
  assert.equal(getIssueDisplayKey(issue), 'TEAMMATES/teammates#13997');
});

test('canonical issue keys can be derived from issue and pull request URLs', async () => {
  const { getCanonicalIssueKey, getIssueDisplayKey } = await import('../src/issueKeys.js');

  assert.equal(
    getCanonicalIssueKey({ html_url: 'https://github.com/OpenAI/Codex/issues/19464' }),
    'openai/codex#19464'
  );
  assert.equal(
    getCanonicalIssueKey({ html_url: 'https://github.com/TEAMMATES/teammates/pull/13998' }),
    'teammates/teammates#13998'
  );
  assert.equal(
    getIssueDisplayKey({ html_url: 'https://github.com/TEAMMATES/teammates/pull/13998' }),
    'TEAMMATES/teammates#13998'
  );
});
