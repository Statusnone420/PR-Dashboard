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
