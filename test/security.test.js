import test from 'node:test';
import assert from 'node:assert/strict';

test('escapeHTML neutralizes HTML metacharacters for template rendering', async () => {
  const { escapeHTML } = await import('../src/security.js');

  assert.equal(
    escapeHTML('<img src=x onerror="alert(1)"> & \'quoted\''),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quoted&#39;'
  );
});

test('getSafeIssueHtmlUrl only accepts GitHub issue URLs or derives from GitHub API issue data', async () => {
  const { getSafeIssueHtmlUrl } = await import('../src/security.js');

  assert.equal(
    getSafeIssueHtmlUrl({
      html_url: 'https://github.com/openai/openai-node/issues/123',
      number: 123
    }),
    'https://github.com/openai/openai-node/issues/123'
  );

  assert.equal(
    getSafeIssueHtmlUrl({
      html_url: 'javascript:alert(1)',
      repository_url: 'https://api.github.com/repos/vitejs/vite',
      number: 456
    }),
    'https://github.com/vitejs/vite/issues/456'
  );

  assert.equal(
    getSafeIssueHtmlUrl({
      html_url: 'https://evil.example/openai/openai-node/issues/123',
      repository_url: 'https://example.com/repos/openai/openai-node',
      number: 123
    }),
    null
  );
});

test('getSafeGitHubAvatarUrl only accepts strict GitHub avatar URLs', async () => {
  const { getSafeGitHubAvatarUrl } = await import('../src/security.js');

  assert.equal(
    getSafeGitHubAvatarUrl('https://avatars.githubusercontent.com/u/123?v=4&s=80'),
    'https://avatars.githubusercontent.com/u/123?v=4&s=80'
  );
  assert.equal(
    getSafeGitHubAvatarUrl('https://avatars.githubusercontent.com/in/987654?v=1'),
    'https://avatars.githubusercontent.com/in/987654?v=1'
  );

  for (const unsafe of [
    'http://avatars.githubusercontent.com/u/123?v=4',
    'https://evil.example/u/123?v=4',
    'https://user:pass@avatars.githubusercontent.com/u/123?v=4',
    'https://avatars.githubusercontent.com/',
    'https://avatars.githubusercontent.com/u/123?v=abc',
    'https://avatars.githubusercontent.com/u/123?s=large',
    'https://avatars.githubusercontent.com/u/123?token=secret',
    'https://avatars.githubusercontent.com/u/123?access_token=secret',
    'https://avatars.githubusercontent.com/u/123#fragment'
  ]) {
    assert.equal(getSafeGitHubAvatarUrl(unsafe), null, unsafe);
  }
});
