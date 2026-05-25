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
  assert.match(getPlatformMismatchReason({
    inspected: true,
    platformSupport: { linux: true },
    platformUnsupported: {},
    reasons: ['Linux setup supported']
  }, ['windows']), /Windows/);
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

test('support-only platform evidence hides when all confirmed support is unchecked', async () => {
  const { getPlatformEvidence, issueMatchesTargetPlatforms } = await import('../src/platformFilters.js');
  const linuxSupportedOnly = {
    inspected: true,
    platformSupport: { linux: true },
    platformUnsupported: {},
    reasons: ['Linux setup supported']
  };

  const evidence = getPlatformEvidence(linuxSupportedOnly, ['windows']);

  assert.equal(evidence.status, 'mismatch');
  assert.deepEqual(evidence.supportedPlatforms, ['linux']);
  assert.equal(issueMatchesTargetPlatforms(linuxSupportedOnly, ['windows']), false);
  assert.equal(issueMatchesTargetPlatforms(linuxSupportedOnly, ['ios', 'macos', 'windows', 'web']), false);
  assert.equal(issueMatchesTargetPlatforms(linuxSupportedOnly, ['linux', 'windows']), true);
});

test('unchecked-only platform filter keeps selected-platform and neutral results visible', async () => {
  const { getPlatformMismatchReason, issueMatchesTargetPlatforms } = await import('../src/platformFilters.js');
  const androidOnly = {
    inspected: true,
    platformSupport: { android: true },
    platformUnsupported: {},
    reasons: ['Android setup supported']
  };
  const windowsAndLinux = {
    inspected: true,
    platformSupport: { windows: true, linux: true },
    platformUnsupported: {},
    reasons: ['Windows setup supported', 'Linux setup supported']
  };
  const neutral = {
    inspected: true,
    platformSupport: {},
    platformUnsupported: {},
    reasons: ['Setup docs found']
  };

  assert.equal(issueMatchesTargetPlatforms(androidOnly, ['ios', 'macos', 'windows', 'web']), false);
  assert.equal(issueMatchesTargetPlatforms(windowsAndLinux, ['ios', 'macos', 'windows', 'web']), true);
  assert.equal(issueMatchesTargetPlatforms(neutral, ['ios', 'macos', 'windows', 'web']), true);
  assert.equal(issueMatchesTargetPlatforms(null, ['ios', 'macos', 'windows', 'web']), true);
  assert.equal(issueMatchesTargetPlatforms(null, ['ios', 'macos', 'windows', 'web'], {
    issue: { repository: { topics: ['android'] } }
  }), false);
  assert.match(getPlatformMismatchReason(null, ['windows'], {
    issue: { repository: { topics: ['android'] } }
  }), /Android.*Windows/);
});

test('platform badge evidence uses confirmed setup and explicit repo topics without target filters', async () => {
  const { getPlatformBadgeEvidence, getPlatformEvidence } = await import('../src/platformFilters.js');
  const issue = {
    repository: {
      topics: ['python', 'linux', 'macos', 'streamlit', 'ubuntu-latest']
    }
  };

  const badgeEvidence = getPlatformBadgeEvidence(issue, null);
  const scoreEvidence = getPlatformEvidence(null, ['ios', 'android', 'macos', 'linux', 'windows', 'web'], { issue });

  assert.equal(badgeEvidence.status, 'confirmed');
  assert.deepEqual(badgeEvidence.supportedPlatforms, ['macos', 'linux']);
  assert.equal(badgeEvidence.label, 'macOS + Linux confirmed');
  assert.equal(scoreEvidence.status, 'confirmed');
  assert.deepEqual(scoreEvidence.supportedPlatforms, ['macos', 'linux']);
});

test('platform badge evidence ignores generic stack topics and respects setup unsupported signals', async () => {
  const { getPlatformBadgeEvidence } = await import('../src/platformFilters.js');
  const genericIssue = {
    repository: {
      topics: ['python', 'streamlit', 'requirements', 'ubuntu-latest', 'frontend']
    }
  };
  const explicitUnsupportedSetup = {
    inspected: true,
    platformSupport: {},
    platformUnsupported: { windows: true },
    reasons: ['Windows setup unsupported']
  };

  assert.deepEqual(getPlatformBadgeEvidence(genericIssue, null).supportedPlatforms, []);
  assert.deepEqual(getPlatformBadgeEvidence({
    repository: { topics: ['windows', 'linux'] }
  }, explicitUnsupportedSetup).supportedPlatforms, ['linux']);
});
