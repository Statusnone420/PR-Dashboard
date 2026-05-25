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
const PLATFORM_TOPIC_ALIASES = {
  ios: new Set(['ios']),
  android: new Set(['android']),
  macos: new Set(['macos', 'mac-os']),
  linux: new Set(['linux']),
  windows: new Set(['windows']),
  web: new Set(['web'])
};

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

function normalizeTopic(value) {
  return String(value || '').trim().toLowerCase();
}

export function getIssuePlatformTopicSupport(issue) {
  const topics = Array.isArray(issue?.repository?.topics) ? issue.repository.topics : [];
  const normalizedTopics = new Set(topics.map(normalizeTopic).filter(Boolean));
  return TARGET_PLATFORM_KEYS.reduce((flags, key) => {
    const aliases = PLATFORM_TOPIC_ALIASES[key] || new Set();
    flags[key] = [...aliases].some(alias => normalizedTopics.has(alias));
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

function getMergedPlatformSupport(setupSummary, options = {}) {
  const support = normalizePlatformFlags(setupSummary?.platformSupport);
  const unsupported = normalizePlatformFlags(setupSummary?.platformUnsupported);
  const topicSupport = normalizePlatformFlags(options.topicSupport || getIssuePlatformTopicSupport(options.issue));
  TARGET_PLATFORM_KEYS.forEach(key => {
    if (!unsupported[key] && topicSupport[key]) {
      support[key] = true;
    }
  });
  return { support, unsupported };
}

export function getPlatformEvidence(setupSummary, targetPlatforms, options = {}) {
  const selected = normalizeTargetPlatforms(targetPlatforms);
  const filterActive = selected.length < TARGET_PLATFORM_KEYS.length;
  const { support, unsupported } = getMergedPlatformSupport(setupSummary, options);
  const supportedKeys = TARGET_PLATFORM_KEYS.filter(key => support[key]);
  const unsupportedKeys = TARGET_PLATFORM_KEYS.filter(key => unsupported[key]);
  const matchedKeys = selected.filter(key => support[key]);
  const topicReasons = supportedKeys
    .filter(key => options.issue && !setupSummary?.platformSupport?.[key])
    .map(key => `${PLATFORM_LABELS[key]} topic confirmed`);
  const reasons = [
    ...(Array.isArray(setupSummary?.reasons) ? setupSummary.reasons : []),
    ...topicReasons
  ];

  if (!setupSummary?.inspected && supportedKeys.length === 0) {
    return createPlatformEvidence('pending', {
      selectedPlatforms: selected,
      filterActive,
      label: 'Platform pending'
    });
  }

  const unsupportedSelected = selected.filter(key => unsupported[key]);
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

  if (filterActive && supportedKeys.length > 0) {
    return createPlatformEvidence('mismatch', {
      ...base,
      label: `${formatPlatformList(supportedKeys)}-only`,
      reasons: [
        ...reasons,
        `Confirmed platform support is outside selected target platforms: ${formatPlatformList(selected)}.`
      ]
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

export function getPlatformBadgeEvidence(issue, setupSummary = null) {
  const evidence = getPlatformEvidence(setupSummary, TARGET_PLATFORM_KEYS, { issue });
  if (!evidence.supportedPlatforms.length) {
    return createPlatformEvidence(evidence.status, {
      ...evidence,
      label: evidence.status === 'pending' ? 'Platform pending' : 'Platform-neutral'
    });
  }
  return createPlatformEvidence('confirmed', {
    ...evidence,
    status: 'confirmed',
    filterActive: false,
    matchedPlatforms: evidence.supportedPlatforms,
    label: `${formatPlatformList(evidence.supportedPlatforms)} confirmed`
  });
}

export function issueMatchesTargetPlatforms(setupSummary, targetPlatforms, options = {}) {
  return getPlatformEvidence(setupSummary, targetPlatforms, options).status !== 'mismatch';
}

export function getPlatformMismatchReason(setupSummary, targetPlatforms, options = {}) {
  const evidence = getPlatformEvidence(setupSummary, targetPlatforms, options);
  if (evidence.status !== 'mismatch') return '';
  const selected = normalizeTargetPlatforms(targetPlatforms);
  const selectedLabel = selected.map(key => PLATFORM_LABELS[key]).join(', ');
  const reasons = Array.isArray(evidence.reasons) ? evidence.reasons : [];
  const selectedReason = selected.map(key => {
    const labelPattern = key === 'macos'
      ? /macos|mac os/i
      : key === 'ios'
        ? /\bios\b/i
        : new RegExp(`\\b${key}\\b`, 'i');
    return reasons.find(reason => labelPattern.test(reason) && /not supported|unsupported|no .*\bsupport\b|does not support|only|required|requires/i.test(reason));
  }).find(Boolean);
  if (selectedReason) return selectedReason;

  const unsupportedSelected = selected.filter(key => evidence.unsupportedPlatforms.includes(key));
  if (unsupportedSelected.length > 0) {
    return `Setup docs mark ${unsupportedSelected.map(key => PLATFORM_LABELS[key]).join(', ')} unsupported.`;
  }

  const supportedKeys = evidence.supportedPlatforms;
  if (supportedKeys.length > 0) {
    return `Platform evidence only confirms ${supportedKeys.map(key => PLATFORM_LABELS[key]).join(', ')} support; selected target platforms: ${selectedLabel}.`;
  }

  const platformReason = reasons.find(reason => /not supported|unsupported|platform mismatch/i.test(reason));
  return platformReason || `Setup docs do not match selected target platforms: ${selectedLabel}`;
}
