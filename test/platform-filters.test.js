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
    platformUnsupported: { windows: true }
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
  assert.doesNotMatch(getPlatformMismatchReason({
    inspected: true,
    platformSupport: { linux: true },
    platformUnsupported: {},
    reasons: ['Linux setup supported']
  }, ['windows']), /Linux setup supported/);
  assert.equal(getPlatformMismatchReason({
    inspected: true,
    platformSupport: { linux: true },
    platformUnsupported: {},
    reasons: ['Linux setup supported']
  }, ['windows']), '');
  assert.equal(issueMatchesTargetPlatforms({
    inspected: true,
    platformSupport: {},
    platformUnsupported: { windows: true }
  }, ['windows', 'web']), true);
  assert.equal(issueMatchesTargetPlatforms(null, ['windows']), true);
});

test('platform evidence keeps neutral results and hides only explicit mismatches', async () => {
  const { getPlatformEvidence, issueMatchesTargetPlatforms } = await import('../src/platformFilters.js');

  const linuxOnly = {
    inspected: true,
    platformSupport: { linux: true },
    platformUnsupported: { ios: true, android: true, macos: true, windows: true, web: true },
    reasons: ['Linux setup supported', 'Windows setup unsupported']
  };
  const linuxAndWindows = {
    inspected: true,
    platformSupport: { linux: true, windows: true },
    platformUnsupported: {},
    reasons: ['Linux setup supported', 'Windows setup supported']
  };
  const neutral = {
    inspected: true,
    platformSupport: {},
    platformUnsupported: {},
    reasons: ['Setup docs found']
  };

  assert.equal(getPlatformEvidence(linuxOnly, ['linux']).status, 'confirmed');
  assert.equal(issueMatchesTargetPlatforms(linuxOnly, ['linux']), true);
  assert.equal(getPlatformEvidence(linuxAndWindows, ['linux']).status, 'confirmed');
  assert.equal(issueMatchesTargetPlatforms(linuxAndWindows, ['linux']), true);
  assert.equal(getPlatformEvidence(linuxOnly, ['windows']).status, 'mismatch');
  assert.equal(issueMatchesTargetPlatforms(linuxOnly, ['windows']), false);
  assert.equal(getPlatformEvidence(neutral, ['linux']).status, 'platform-neutral');
  assert.equal(issueMatchesTargetPlatforms(neutral, ['linux']), true);
  assert.equal(getPlatformEvidence(null, ['linux']).status, 'pending');
  assert.equal(issueMatchesTargetPlatforms(null, ['linux']), true);
});

test('support-only platform evidence does not hide unconfirmed target platforms', async () => {
  const { getPlatformEvidence, issueMatchesTargetPlatforms } = await import('../src/platformFilters.js');
  const linuxSupportedOnly = {
    inspected: true,
    platformSupport: { linux: true },
    platformUnsupported: {},
    reasons: ['Linux setup supported']
  };

  const evidence = getPlatformEvidence(linuxSupportedOnly, ['windows']);

  assert.equal(evidence.status, 'platform-neutral');
  assert.deepEqual(evidence.supportedPlatforms, ['linux']);
  assert.equal(issueMatchesTargetPlatforms(linuxSupportedOnly, ['windows']), true);
});
