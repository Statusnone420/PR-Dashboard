export const CONTRIBUTION_PREFERENCES_STORAGE_KEY = 'pr_dashboard_contribution_preferences_v1';

const EXPERIENCE_VALUES = new Set(['first-pr', 'comfortable', 'advanced', '']);
const TIME_BUDGET_VALUES = new Set(['under-1-hour', 'half-day', 'weekend', '']);
const MAX_LIST_ITEMS = 20;
const MAX_ITEM_LENGTH = 40;

function getStorage(storage) {
  return storage || globalThis.localStorage || null;
}

function cleanString(value) {
  return String(value || '').trim().slice(0, MAX_ITEM_LENGTH);
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const cleaned = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const clean = cleanString(item);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(clean);
    if (cleaned.length >= MAX_LIST_ITEMS) break;
  }

  return cleaned;
}

function cleanIsoTimestamp(value) {
  const source = typeof value === 'string' ? value : '';
  const parsed = Date.parse(source);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

export function createDefaultContributionPreferences(options = {}) {
  return {
    version: 1,
    languages: [],
    preferredWork: [],
    avoidWork: [],
    experience: '',
    timeBudget: '',
    saved_at: options.now || new Date().toISOString()
  };
}

export function normalizeContributionPreferences(preferences = {}, options = {}) {
  const base = createDefaultContributionPreferences(options);
  const experience = cleanString(preferences.experience);
  const timeBudget = cleanString(preferences.timeBudget);

  return {
    version: 1,
    languages: cleanList(preferences.languages),
    preferredWork: cleanList(preferences.preferredWork),
    avoidWork: cleanList(preferences.avoidWork),
    experience: EXPERIENCE_VALUES.has(experience) ? experience : '',
    timeBudget: TIME_BUDGET_VALUES.has(timeBudget) ? timeBudget : '',
    saved_at: cleanIsoTimestamp(preferences.saved_at || base.saved_at)
  };
}

export function loadContributionPreferences(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return null;

  try {
    const raw = targetStorage.getItem(CONTRIBUTION_PREFERENCES_STORAGE_KEY);
    if (!raw) return null;
    return normalizeContributionPreferences(JSON.parse(raw));
  } catch {
    targetStorage.removeItem(CONTRIBUTION_PREFERENCES_STORAGE_KEY);
    return null;
  }
}

export function saveContributionPreferences(preferences, storage = getStorage(), options = {}) {
  const targetStorage = getStorage(storage);
  const normalized = normalizeContributionPreferences(preferences, options);
  if (targetStorage) {
    targetStorage.setItem(CONTRIBUTION_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function clearContributionPreferences(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (targetStorage) targetStorage.removeItem(CONTRIBUTION_PREFERENCES_STORAGE_KEY);
}

function timestampValue(value) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
}

export function mergeContributionPreferences(currentPreferences, importedPreferences) {
  const current = currentPreferences ? normalizeContributionPreferences(currentPreferences) : null;
  const imported = importedPreferences ? normalizeContributionPreferences(importedPreferences) : null;
  if (!current) return imported;
  if (!imported) return current;
  return timestampValue(imported.saved_at) > timestampValue(current.saved_at) ? imported : current;
}
