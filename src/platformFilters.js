export const TARGET_PLATFORM_OPTIONS = [
  { key: 'ios', label: 'iOS' },
  { key: 'android', label: 'Android' },
  { key: 'macos', label: 'macOS' },
  { key: 'linux', label: 'Linux' },
  { key: 'windows', label: 'Windows' },
  { key: 'web', label: 'Web' }
];

export const TARGET_PLATFORM_KEYS = TARGET_PLATFORM_OPTIONS.map(platform => platform.key);

const PLATFORM_KEY_SET = new Set(TARGET_PLATFORM_KEYS);

const PLATFORM_LABELS = Object.fromEntries(TARGET_PLATFORM_OPTIONS.map(platform => [platform.key, platform.label]));

export function normalizeTargetPlatforms(value) {
  const selected = Array.isArray(value)
    ? value.map(item => String(item || '').toLowerCase()).filter(item => PLATFORM_KEY_SET.has(item))
    : [];
  const unique = TARGET_PLATFORM_KEYS.filter(key => selected.includes(key));
  return unique.length ? unique : [...TARGET_PLATFORM_KEYS];
}

export function getNextTargetPlatforms(current, key, checked) {
  const normalized = normalizeTargetPlatforms(current);
  const platform = String(key || '').toLowerCase();
  if (!PLATFORM_KEY_SET.has(platform)) return normalized;

  if (checked) {
    return TARGET_PLATFORM_KEYS.filter(item => item === platform || normalized.includes(item));
  }

  if (normalized.length <= 1 && normalized.includes(platform)) {
    return normalized;
  }

  const next = normalized.filter(item => item !== platform);
  return next.length ? next : normalized;
}

export function hasAllTargetPlatformsSelected(value) {
  return normalizeTargetPlatforms(value).length === TARGET_PLATFORM_KEYS.length;
}

function normalizePlatformFlags(value) {
  const source = value && typeof value === 'object' ? value : {};
  return TARGET_PLATFORM_KEYS.reduce((flags, key) => {
    flags[key] = Boolean(source[key]);
    return flags;
  }, {});
}

function formatPlatformList(keys = []) {
  return keys.map(key => PLATFORM_LABELS[key] || key).join(' + ');
}

function createPlatformEvidence(status, values) {
  return {
    status,
    selectedPlatforms: [],
    supportedPlatforms: [],
    unsupportedPlatforms: [],
    matchedPlatforms: [],
    filterActive: false,
    label: 'Platform-neutral',
    reasons: [],
    ...values
  };
}

export function getPlatformEvidence(setupSummary, targetPlatforms) {
  const selected = normalizeTargetPlatforms(targetPlatforms);
  const filterActive = selected.length < TARGET_PLATFORM_KEYS.length;
  if (!setupSummary?.inspected) {
    return createPlatformEvidence('pending', {
      selectedPlatforms: selected,
      filterActive,
      label: 'Platform pending'
    });
  }

  const support = normalizePlatformFlags(setupSummary?.platformSupport);
  const unsupported = normalizePlatformFlags(setupSummary?.platformUnsupported);
  const supportedKeys = TARGET_PLATFORM_KEYS.filter(key => support[key]);
  const unsupportedKeys = TARGET_PLATFORM_KEYS.filter(key => unsupported[key]);
  const matchedKeys = selected.filter(key => support[key]);
  const unsupportedSelected = selected.filter(key => unsupported[key]);
  const reasons = Array.isArray(setupSummary?.reasons) ? setupSummary.reasons : [];
  const base = {
    selectedPlatforms: selected,
    supportedPlatforms: supportedKeys,
    unsupportedPlatforms: unsupportedKeys,
    matchedPlatforms: matchedKeys,
    filterActive,
    reasons
  };

  if (matchedKeys.length > 0) {
    return createPlatformEvidence('confirmed', {
      ...base,
      label: `${formatPlatformList(matchedKeys)} confirmed`
    });
  }

  if (selected.length > 0 && selected.every(key => unsupported[key])) {
    const onlyPlatform = supportedKeys.length === 1
      && TARGET_PLATFORM_KEYS.every(key => key === supportedKeys[0] || unsupported[key]);
    return createPlatformEvidence('mismatch', {
      ...base,
      label: onlyPlatform
        ? `${formatPlatformList(supportedKeys)}-only`
        : `${formatPlatformList(unsupportedSelected)} unsupported`
    });
  }

  return createPlatformEvidence('platform-neutral', {
    ...base,
    label: supportedKeys.length > 0
      ? `${formatPlatformList(supportedKeys)} confirmed`
      : 'Platform-neutral'
  });
}

export function issueMatchesTargetPlatforms(setupSummary, targetPlatforms) {
  return getPlatformEvidence(setupSummary, targetPlatforms).status !== 'mismatch';
}

export function getPlatformMismatchReason(setupSummary, targetPlatforms) {
  const evidence = getPlatformEvidence(setupSummary, targetPlatforms);
  if (evidence.status !== 'mismatch') return '';
  const selected = normalizeTargetPlatforms(targetPlatforms);
  const selectedLabel = selected.map(key => PLATFORM_LABELS[key]).join(', ');
  const reasons = Array.isArray(setupSummary?.reasons) ? setupSummary.reasons : [];
  const support = normalizePlatformFlags(setupSummary?.platformSupport);
  const unsupported = normalizePlatformFlags(setupSummary?.platformUnsupported);
  const selectedReason = selected.map(key => {
    const labelPattern = key === 'macos'
      ? /macos|mac os/i
      : key === 'ios'
        ? /\bios\b/i
        : new RegExp(`\\b${key}\\b`, 'i');
    return reasons.find(reason => labelPattern.test(reason) && /not supported|unsupported|no .*\bsupport\b|does not support|only|required|requires/i.test(reason));
  }).find(Boolean);
  if (selectedReason) return selectedReason;

  const unsupportedSelected = selected.filter(key => unsupported[key]);
  if (unsupportedSelected.length > 0) {
    return `Setup docs mark ${unsupportedSelected.map(key => PLATFORM_LABELS[key]).join(', ')} unsupported.`;
  }

  const supportedKeys = TARGET_PLATFORM_KEYS.filter(key => support[key]);
  if (supportedKeys.length > 0) {
    return `Setup docs only confirm ${supportedKeys.map(key => PLATFORM_LABELS[key]).join(', ')} support; selected target platforms: ${selectedLabel}.`;
  }

  const platformReason = reasons.find(reason => /not supported|unsupported|platform mismatch/i.test(reason));
  return platformReason || `Setup docs do not match selected target platforms: ${selectedLabel}`;
}
