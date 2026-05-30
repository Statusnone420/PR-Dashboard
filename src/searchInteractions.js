import { TARGET_PLATFORM_KEYS, normalizeTargetPlatforms } from './platformFilters.js';

const STARS_THRESHOLDS = {
  '50+': 50,
  '100+': 100,
  '500+': 500,
  '1k+': 1000,
  '5k+': 5000,
  '10k+': 10000
};

const COMMENT_RANGES = {
  'Low (0-5)': { min: 0, max: 5, label: 'Low (0-5)' },
  'Medium (6-15)': { min: 6, max: 15, label: 'Medium (6-15)' },
  'High (15+)': { min: 16, max: null, label: 'High (15+)' }
};

const UPDATED_DATE_DAYS = {
  'Last 24h': 1,
  'Last week': 7,
  'Last month': 30
};

const DIFFICULTY_OPTIONS = new Set(['Any', 'Beginner', 'Intermediate', 'Advanced']);

function cleanStringList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map(item => String(item || '').trim())
    .filter(item => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeDifficulty(value) {
  const difficulty = String(value || 'Any');
  return DIFFICULTY_OPTIONS.has(difficulty) ? difficulty : 'Any';
}

export function getStarsThreshold(value) {
  return STARS_THRESHOLDS[value] || 0;
}

export function getCommentRange(value) {
  return COMMENT_RANGES[value] || null;
}

export function getUpdatedDateDays(value) {
  return UPDATED_DATE_DAYS[value] || 0;
}

export function buildFinderIntent(filters = {}, profile = null) {
  return {
    selectedLabels: cleanStringList(filters.labels),
    labelMode: 'OR',
    starsThreshold: getStarsThreshold(filters.stars),
    commentsRange: getCommentRange(filters.comments),
    updatedDateDays: getUpdatedDateDays(filters.updatedDate),
    unassignedOnly: Boolean(filters.unassigned),
    difficulty: normalizeDifficulty(filters.difficulty),
    targetPlatforms: normalizeTargetPlatforms(filters.targetPlatforms),
    profile: profile || null
  };
}

export function applyFilterPatch(appStore, patch) {
  if (typeof appStore.setDraftFilters === 'function') {
    appStore.setDraftFilters(patch);
    return;
  }
  appStore.setFilters(patch);
}

export function shouldApplyTargetPlatformResultFilter(filters = {}, mode = 'find') {
  return mode !== 'lookup' || Boolean(filters?.useFiltersInLookup);
}

export function getScoreTargetPlatformsForMode(filters = {}, mode = 'find') {
  return shouldApplyTargetPlatformResultFilter(filters, mode)
    ? normalizeTargetPlatforms(filters?.targetPlatforms)
    : [...TARGET_PLATFORM_KEYS];
}

export function getScoreFiltersForMode(filters = {}, mode = 'find', options = {}) {
  const screen = options.currentScreen || 'find-issues';
  const shouldApplyFinderFilters = screen === 'find-issues'
    && (mode !== 'lookup' || Boolean(filters?.useFiltersInLookup));
  return shouldApplyFinderFilters ? filters : getRelaxedFilters();
}

export function getPresetFilterPatch(preset) {
  if (preset === 'quick-wins') {
    return {
      difficulty: 'Beginner',
      labels: [],
      labelMode: 'OR',
      comments: 'Low (0-5)',
      stars: 'Any',
      updatedDate: 'Any',
      includeClosed: false,
      unassigned: true
    };
  }

  if (preset === 'deep-dives') {
    return {
      difficulty: 'Advanced',
      labels: ['help wanted'],
      labelMode: 'OR',
      comments: 'Any',
      stars: 'Any',
      updatedDate: 'Any',
      includeClosed: false,
      unassigned: false
    };
  }

  if (preset === 'docs-only') {
    return {
      difficulty: 'Any',
      labels: ['docs', 'documentation'],
      labelMode: 'OR',
      comments: 'Any',
      stars: 'Any',
      updatedDate: 'Any',
      includeClosed: false,
      unassigned: false
    };
  }

  if (preset === 'low-noise') {
    return {
      difficulty: 'Any',
      labels: ['help wanted'],
      labelMode: 'OR',
      comments: 'Low (0-5)',
      stars: 'Any',
      updatedDate: 'Last month',
      includeClosed: false,
      unassigned: true
    };
  }

  if (preset === 'tests') {
    return {
      difficulty: 'Any',
      labels: ['testing', 'type:testing'],
      labelMode: 'OR',
      comments: 'Low (0-5)',
      stars: 'Any',
      updatedDate: 'Any',
      includeClosed: false,
      unassigned: true
    };
  }

  return null;
}

export function getRelaxedFilters() {
  return {
    languages: [],
    labels: [],
    labelMode: 'OR',
    difficulty: 'Any',
    stars: 'Any',
    comments: 'Any',
    updatedDate: 'Any',
    includeClosed: false,
    unassigned: false,
    targetPlatforms: [...TARGET_PLATFORM_KEYS]
  };
}

export function applyPresetSearch(appStore, preset, searchFn) {
  const patch = getPresetFilterPatch(preset);
  if (!patch) return null;

  appStore.setFilters(patch);
  return searchFn(appStore.searchQuery, true);
}
