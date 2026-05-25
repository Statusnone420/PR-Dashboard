import { TARGET_PLATFORM_KEYS } from './platformFilters.js';

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

export function getPresetFilterPatch(preset) {
  if (preset === 'quick-wins') {
    return {
      labels: ['good first issue', 'help wanted'],
      labelMode: 'OR',
      comments: 'Low (0-5)',
      stars: '1k+'
    };
  }

  if (preset === 'deep-dives') {
    return {
      labels: ['help wanted'],
      labelMode: 'OR',
      comments: 'High (15+)',
      stars: '5k+'
    };
  }

  if (preset === 'docs-only') {
    return {
      labels: ['docs'],
      labelMode: 'OR',
      comments: 'Any',
      stars: 'Any'
    };
  }

  if (preset === 'low-noise') {
    return {
      labels: ['help wanted'],
      labelMode: 'OR',
      comments: 'Low (0-5)',
      stars: 'Any',
      updatedDate: 'Last month'
    };
  }

  return null;
}

export function getRelaxedFilters() {
  return {
    languages: [],
    labels: [],
    labelMode: 'OR',
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
