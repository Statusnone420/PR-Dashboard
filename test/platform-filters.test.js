import test from 'node:test';
import assert from 'node:assert/strict';

test('target platforms default to every supported platform', async () => {
  const { TARGET_PLATFORM_KEYS, normalizeTargetPlatforms } = await import('../src/platformFilters.js');

  assert.deepEqual(normalizeTargetPlatforms(), TARGET_PLATFORM_KEYS);
});

test('target platform toggle prevents an empty selection', async () => {
  const { getNextTargetPlatforms } = await import('../src/platformFilters.js');

  assert.deepEqual(getNextTargetPlatforms(['linux'], 'linux', false), ['linux']);
  assert.deepEqual(getNextTargetPlatforms(['linux'], 'windows', true), ['linux', 'windows']);
  assert.deepEqual(getNextTargetPlatforms(['linux', 'windows'], 'linux', false), ['windows']);
});

test('platform mismatch requires known incompatibility with every selected platform', async () => {
  const { getPlatformMismatchReason, issueMatchesTargetPlatforms } = await import('../src/platformFilters.js');

  assert.equal(issueMatchesTargetPlatforms({
    inspected: true,
    platformSupport: { linux: true },
    platformUnsupported: {}
  }, ['windows']), false);
  assert.equal(issueMatchesTargetPlatforms({
    inspected: true,
    platformSupport: { linux: true },
    platformUnsupported: {}
  }, ['linux', 'windows']), true);
  assert.equal(issueMatchesTargetPlatforms({
    inspected: true,
    platformSupport: {},
    platformUnsupported: { windows: true },
    reasons: ['iOS setup unsupported', 'Windows setup unsupported']
  }, ['windows']), false);
  assert.match(getPlatformMismatchReason({
    inspected: true,
    platformSupport: {},
    platformUnsupported: { windows: true },
    reasons: ['iOS setup unsupported', 'Windows setup unsupported']
  }, ['windows']), /Windows/);
  assert.equal(issueMatchesTargetPlatforms({
    inspected: true,
    platformSupport: {},
    platformUnsupported: { windows: true }
  }, ['windows', 'web']), true);
  assert.equal(issueMatchesTargetPlatforms(null, ['windows']), true);
});
