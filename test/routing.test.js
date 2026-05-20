import test from 'node:test';
import assert from 'node:assert/strict';

test('screenFromHash resolves supported hash routes', async () => {
  const { screenFromHash } = await import('../src/routing.js');

  assert.equal(screenFromHash('#find-issues'), 'find-issues');
  assert.equal(screenFromHash('#board'), 'board');
  assert.equal(screenFromHash('#settings'), 'settings');
});

test('screenFromHash falls back to dashboard for unknown hashes', async () => {
  const { screenFromHash } = await import('../src/routing.js');

  assert.equal(screenFromHash(''), 'dashboard');
  assert.equal(screenFromHash('#help'), 'dashboard');
});
