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

export function issueMatchesTargetPlatforms(setupSummary, targetPlatforms) {
  const selected = normalizeTargetPlatforms(targetPlatforms);
  if (!setupSummary?.inspected) return true;

  const support = normalizePlatformFlags(setupSummary.platformSupport);
  const unsupported = normalizePlatformFlags(setupSummary.platformUnsupported);
  const supportedKeys = TARGET_PLATFORM_KEYS.filter(key => support[key]);

  if (supportedKeys.length > 0) {
    return selected.some(key => support[key]);
  }

  if (selected.every(key => unsupported[key])) {
    return false;
  }

  return true;
}

export function getPlatformMismatchReason(setupSummary, targetPlatforms) {
  if (issueMatchesTargetPlatforms(setupSummary, targetPlatforms)) return '';
  const selected = normalizeTargetPlatforms(targetPlatforms);
  const labels = Object.fromEntries(TARGET_PLATFORM_OPTIONS.map(item => [item.key, item.label]));
  const selectedLabel = selected.map(key => labels[key]).join(', ');
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
    return `Setup docs mark ${unsupportedSelected.map(key => labels[key]).join(', ')} unsupported.`;
  }

  const supportedKeys = TARGET_PLATFORM_KEYS.filter(key => support[key]);
  if (supportedKeys.length > 0) {
    return `Setup docs only confirm ${supportedKeys.map(key => labels[key]).join(', ')} support; selected target platforms: ${selectedLabel}.`;
  }

  const platformReason = reasons.find(reason => /not supported|unsupported|platform mismatch/i.test(reason));
  return platformReason || `Setup docs do not match selected target platforms: ${selectedLabel}`;
}
