import { getCanonicalIssueKey, getCanonicalRepoKey } from './issueKeys.js';

export const MATCH_FEEDBACK_STORAGE_KEY = 'pr_dashboard_match_feedback_v1';

const TOTAL_KEYS = ['saved', 'working', 'passed', 'merged', 'hiddenIssue', 'hiddenRepo'];
const BUCKET_KEYS = ['languages', 'workTypes', 'scope', 'repo', 'labels'];
const ACTION_TO_TOTAL = {
  saved: 'saved',
  'entered:Working': 'working',
  'entered:Passed': 'passed',
  'entered:Merged': 'merged',
  hiddenIssue: 'hiddenIssue',
  hiddenRepo: 'hiddenRepo'
};
const TOTAL_TO_ACTION = {
  saved: 'saved',
  working: 'entered:Working',
  passed: 'entered:Passed',
  merged: 'entered:Merged',
  hiddenIssue: 'hiddenIssue',
  hiddenRepo: 'hiddenRepo'
};
const POSITIVE_ACTIONS = ['saved', 'working', 'merged'];
const NEGATIVE_ACTIONS = ['passed', 'hiddenIssue', 'hiddenRepo'];
const WORK_TYPE_TERMS = {
  docs: ['docs', 'documentation', 'readme', 'copy', 'wording'],
  readme: ['readme'],
  tests: ['test', 'tests', 'testing'],
  config: ['config', 'configuration', 'settings'],
  ui: ['ui', 'button', 'label', 'tooltip', 'copy'],
  bug: ['bug', 'fix', 'broken', 'expected', 'actual'],
  refactor: ['refactor', 'rewrite', 'architecture'],
  migration: ['migration', 'migrate'],
  api: ['api', 'endpoint']
};
const SMALL_SCOPE_TERMS = ['docs', 'documentation', 'readme', 'typo', 'config', 'cleanup', 'spelling', 'copy'];
const LARGE_SCOPE_TERMS = ['rewrite', 'entire', 'architecture', 'large refactor', 'across everything', 'migration', 'redesign'];

function getStorage(storage) {
  return storage || globalThis.localStorage || null;
}

function nowIso(options = {}) {
  const value = options.now || new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function createTotals() {
  return Object.fromEntries(TOTAL_KEYS.map(key => [key, 0]));
}

function createBuckets() {
  return Object.fromEntries(BUCKET_KEYS.map(key => [key, {}]));
}

export function createEmptyMatchFeedback(options = {}) {
  return {
    version: 1,
    updated_at: nowIso(options),
    totals: createTotals(),
    buckets: createBuckets(),
    events: {}
  };
}

function cleanString(value, options = {}) {
  const max = options.max || 80;
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.slice(0, max);
}

function cleanLower(value, options = {}) {
  return cleanString(value, options).toLowerCase();
}

function uniqueValues(values, normalizer, limit = 16) {
  const seen = new Set();
  const clean = [];
  for (const value of Array.isArray(values) ? values : []) {
    const item = normalizer(value);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    clean.push(item);
    if (clean.length >= limit) break;
  }
  return clean;
}

function normalizeAction(action, key = '') {
  const value = String(action || '').trim();
  if (ACTION_TO_TOTAL[value]) return value;
  const keyAction = String(key || '').split('|').pop();
  return ACTION_TO_TOTAL[keyAction] ? keyAction : null;
}

function normalizeTimestamp(value, fallback) {
  const date = new Date(value || fallback || new Date().toISOString());
  return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
}

function labelsForIssue(issue) {
  return uniqueValues(
    issue?.labels || [],
    label => cleanLower(typeof label === 'object' ? label.name : label, { max: 60 }),
    20
  );
}

function issueText(issue) {
  return `${issue?.title || ''}\n${issue?.body || ''}`.toLowerCase();
}

function hasWholeTerm(text, term) {
  return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(text);
}

function inferWorkTypes(issue) {
  const labels = labelsForIssue(issue);
  const text = issueText(issue);
  return Object.entries(WORK_TYPE_TERMS)
    .filter(([, terms]) => terms.some(term => labels.some(label => hasWholeTerm(label, term)) || hasWholeTerm(text, term)))
    .map(([key]) => key);
}

function inferScope(issue) {
  const text = issueText(issue);
  if (LARGE_SCOPE_TERMS.some(term => text.includes(term))) return 'Large/unclear';
  if (SMALL_SCOPE_TERMS.some(term => text.includes(term))) return 'Small';
  return 'Medium';
}

function extractFeedbackFeatures(issue) {
  const language = cleanString(issue?.repository?.language, { max: 40 });
  const repo = getCanonicalRepoKey(issue);
  return {
    language,
    repo: repo || '',
    labels: labelsForIssue(issue),
    workTypes: inferWorkTypes(issue),
    scope: inferScope(issue)
  };
}

function normalizeFeatures(features = {}) {
  const language = cleanString(features.language, { max: 40 });
  const repo = cleanLower(features.repo || features.repoKey, { max: 120 });
  const scope = ['Small', 'Medium', 'Large/unclear'].includes(features.scope) ? features.scope : '';
  return {
    language,
    repo,
    labels: uniqueValues(features.labels, label => cleanLower(label, { max: 60 }), 20),
    workTypes: uniqueValues(features.workTypes, type => cleanLower(type, { max: 40 }), 12),
    scope
  };
}

function compactEvent(key, value, fallbackUpdatedAt) {
  const event = typeof value === 'string' ? { at: value } : value && typeof value === 'object' ? value : {};
  const action = normalizeAction(event.action, key);
  if (!action) return null;
  const features = normalizeFeatures(event.features || {});
  const compact = {
    at: normalizeTimestamp(event.at, fallbackUpdatedAt),
    action,
    features
  };
  const issueKey = cleanLower(event.issueKey, { max: 140 });
  const repoKey = cleanLower(event.repoKey, { max: 120 });
  if (issueKey) compact.issueKey = issueKey;
  if (repoKey) compact.repoKey = repoKey;
  return compact;
}

function bucketAdd(bucket, bucketKey, totalKey) {
  if (!bucketKey) return;
  if (!bucket[bucketKey]) bucket[bucketKey] = createTotals();
  bucket[bucketKey][totalKey] += 1;
}

function recomputeFromEvents(events, updatedAt) {
  const feedback = createEmptyMatchFeedback({ now: updatedAt });
  feedback.events = events;

  for (const event of Object.values(events)) {
    const totalKey = ACTION_TO_TOTAL[event.action];
    if (!totalKey) continue;
    feedback.totals[totalKey] += 1;
    const features = normalizeFeatures(event.features || {});
    bucketAdd(feedback.buckets.languages, features.language, totalKey);
    bucketAdd(feedback.buckets.repo, features.repo, totalKey);
    bucketAdd(feedback.buckets.scope, features.scope, totalKey);
    for (const workType of features.workTypes) {
      bucketAdd(feedback.buckets.workTypes, workType, totalKey);
    }
    for (const label of features.labels) {
      bucketAdd(feedback.buckets.labels, label, totalKey);
    }
  }

  return feedback;
}

function eventTotals(events) {
  return recomputeFromEvents(events, nowIso()).totals;
}

function normalizeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function hasModernFeatureEvents(events = {}) {
  return Object.values(events).some(event => (
    event
    && typeof event === 'object'
    && event.features
    && typeof event.features === 'object'
    && Object.values(normalizeFeatures(event.features)).some(value => Array.isArray(value) ? value.length > 0 : Boolean(value))
  ));
}

function addLegacyCounterEvents(events, payload, updatedAt) {
  if (!payload?.totals || hasModernFeatureEvents(payload.events)) return events;
  const merged = { ...events };

  for (const totalKey of TOTAL_KEYS) {
    const count = normalizeCount(payload.totals[totalKey]);
    const action = TOTAL_TO_ACTION[totalKey];
    for (let index = 0; index < count; index += 1) {
      const key = `legacy-counter|${action}|${index}`;
      if (merged[key]) continue;
      merged[key] = {
        at: normalizeTimestamp(updatedAt, updatedAt),
        action,
        features: {}
      };
    }
  }

  return merged;
}

function normalizeBucketTotals(bucketValue = {}) {
  const bucket = {};
  if (!bucketValue || typeof bucketValue !== 'object') return bucket;
  for (const [rawKey, rawCounts] of Object.entries(bucketValue)) {
    const key = cleanString(rawKey, { max: 120 });
    if (!key || !rawCounts || typeof rawCounts !== 'object') continue;
    bucket[key] = createTotals();
    for (const totalKey of TOTAL_KEYS) {
      bucket[key][totalKey] = normalizeCount(rawCounts[totalKey]);
    }
  }
  return bucket;
}

function normalizeProvidedSummary(payload = {}) {
  const totals = createTotals();
  for (const totalKey of TOTAL_KEYS) {
    totals[totalKey] = normalizeCount(payload?.totals?.[totalKey]);
  }

  return {
    version: 1,
    updated_at: normalizeTimestamp(payload.updated_at, nowIso()),
    totals,
    buckets: {
      languages: normalizeBucketTotals(payload?.buckets?.languages),
      workTypes: normalizeBucketTotals(payload?.buckets?.workTypes),
      scope: normalizeBucketTotals(payload?.buckets?.scope),
      repo: normalizeBucketTotals(payload?.buckets?.repo),
      labels: normalizeBucketTotals(payload?.buckets?.labels)
    },
    events: {}
  };
}

export function normalizeMatchFeedback(payload = {}) {
  if (!payload || typeof payload !== 'object') return createEmptyMatchFeedback();

  const updatedAt = normalizeTimestamp(payload.updated_at, nowIso());
  let events = {};
  for (const [rawKey, rawEvent] of Object.entries(payload.events || {})) {
    const key = cleanString(rawKey, { max: 180 });
    if (!key || events[key]) continue;
    const event = compactEvent(key, rawEvent, updatedAt);
    if (event) events[key] = event;
  }

  if (Object.keys(events).length === 0 && payload.buckets) {
    return normalizeProvidedSummary(payload);
  }

  events = addLegacyCounterEvents(events, payload, updatedAt);

  return recomputeFromEvents(events, updatedAt);
}

export function loadMatchFeedback(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return createEmptyMatchFeedback();
  try {
    const raw = targetStorage.getItem(MATCH_FEEDBACK_STORAGE_KEY);
    if (!raw) return createEmptyMatchFeedback();
    return normalizeMatchFeedback(JSON.parse(raw));
  } catch {
    return createEmptyMatchFeedback();
  }
}

export function saveMatchFeedback(feedback, storage = getStorage(), options = {}) {
  const targetStorage = getStorage(storage);
  const normalized = normalizeMatchFeedback({
    ...feedback,
    updated_at: options.now || feedback?.updated_at || new Date().toISOString()
  });
  if (targetStorage) {
    targetStorage.setItem(MATCH_FEEDBACK_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function clearMatchFeedback(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (targetStorage) {
    targetStorage.removeItem(MATCH_FEEDBACK_STORAGE_KEY);
  }
}

function eventKeyForIssueAction(issue, action) {
  const issueKey = getCanonicalIssueKey(issue);
  const repoKey = getCanonicalRepoKey(issue);
  if (action === 'hiddenRepo') return repoKey ? `${repoKey}|${action}` : null;
  return issueKey ? `${issueKey}|${action}` : null;
}

export function recordMatchFeedbackEvent(issue, action, storage = getStorage(), options = {}) {
  const normalizedAction = normalizeAction(action);
  if (!normalizedAction) return loadMatchFeedback(storage);
  const key = eventKeyForIssueAction(issue, normalizedAction);
  if (!key) return loadMatchFeedback(storage);

  const current = loadMatchFeedback(storage);
  if (current.events[key]) return current;

  const features = extractFeedbackFeatures(issue);
  const issueKey = getCanonicalIssueKey(issue);
  const repoKey = getCanonicalRepoKey(issue);
  const next = {
    ...current,
    updated_at: nowIso(options),
    events: {
      ...current.events,
      [key]: {
        at: nowIso(options),
        action: normalizedAction,
        issueKey: issueKey || undefined,
        repoKey: repoKey || undefined,
        features
      }
    }
  };

  return saveMatchFeedback(next, storage, { now: options.now });
}

export function mergeMatchFeedback(currentFeedback, importedFeedback) {
  const current = normalizeMatchFeedback(currentFeedback);
  const imported = normalizeMatchFeedback(importedFeedback);
  const events = { ...current.events };

  for (const [key, event] of Object.entries(imported.events)) {
    if (!events[key]) {
      events[key] = event;
      continue;
    }
    const currentTime = Date.parse(events[key].at || '');
    const importedTime = Date.parse(event.at || '');
    if (Number.isFinite(importedTime) && (!Number.isFinite(currentTime) || importedTime < currentTime)) {
      events[key] = event;
    }
  }

  const updatedAt = [current.updated_at, imported.updated_at]
    .sort((a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0))[0] || nowIso();
  return recomputeFromEvents(events, updatedAt);
}

function findBucketCounts(bucket = {}, key, aliases = []) {
  const keys = [key, ...aliases].filter(Boolean).map(value => String(value).toLowerCase());
  for (const [bucketKey, counts] of Object.entries(bucket || {})) {
    if (keys.includes(String(bucketKey).toLowerCase())) {
      return counts || {};
    }
  }
  return {};
}

function positiveScore(counts = {}) {
  return normalizeCount(counts.saved) + (normalizeCount(counts.working) * 2) + (normalizeCount(counts.merged) * 3);
}

function negativeScore(counts = {}) {
  return (normalizeCount(counts.passed) * 2) + (normalizeCount(counts.hiddenIssue) * 2) + (normalizeCount(counts.hiddenRepo) * 3);
}

function addPatternScores(summary, features, scores) {
  const languageCounts = findBucketCounts(summary.buckets.languages, features.language);
  scores.positive += positiveScore(languageCounts);
  scores.negative += negativeScore(languageCounts);

  const repoCounts = findBucketCounts(summary.buckets.repo, features.repo);
  scores.positive += positiveScore(repoCounts);
  scores.negative += negativeScore(repoCounts);

  const scopeCounts = findBucketCounts(summary.buckets.scope, features.scope);
  scores.positive += positiveScore(scopeCounts);
  scores.negative += negativeScore(scopeCounts);

  for (const workType of features.workTypes) {
    const counts = findBucketCounts(summary.buckets.workTypes, workType);
    scores.positive += positiveScore(counts);
    scores.negative += negativeScore(counts);
  }

  for (const label of features.labels) {
    const counts = findBucketCounts(summary.buckets.labels, label);
    scores.positive += positiveScore(counts);
    scores.negative += negativeScore(counts);
  }
}

export function getFeedbackScoreAdjustment(issue, feedback) {
  if (!feedback || typeof feedback !== 'object') {
    return { adjustment: 0, rows: [] };
  }

  const summary = normalizeMatchFeedback(feedback);
  const features = extractFeedbackFeatures(issue);
  const scores = { positive: 0, negative: 0 };
  addPatternScores(summary, features, scores);

  const raw = scores.positive - scores.negative;
  const adjustment = Math.max(-10, Math.min(8, raw));
  if (adjustment > 0) {
    return {
      adjustment,
      rows: [{ points: adjustment, label: 'Matches your completed contribution patterns' }]
    };
  }
  if (adjustment < 0) {
    return {
      adjustment,
      rows: [{ points: adjustment, label: 'Similar items were passed or hidden locally' }]
    };
  }
  return { adjustment: 0, rows: [] };
}

export function summarizeMatchFeedback(feedback) {
  const summary = normalizeMatchFeedback(feedback);
  return {
    updated_at: summary.updated_at,
    totals: summary.totals,
    eventCount: Object.keys(summary.events).length
  };
}
