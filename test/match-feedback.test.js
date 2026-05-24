import test from 'node:test';
import assert from 'node:assert/strict';

function createLocalStorage() {
  const storage = new Map();
  return {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  };
}

function issue(overrides = {}) {
  return {
    id: 13997,
    number: 13997,
    title: 'Fix README setup command',
    body: 'Expected behavior: update the README setup command and add a small test.',
    labels: [{ name: 'documentation' }, { name: 'tests' }],
    repository: {
      full_name: 'TEAMMATES/teammates',
      language: 'TypeScript'
    },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13997',
    ...overrides
  };
}

test('match feedback records compact idempotent event markers and recomputes aggregates', async () => {
  const storage = createLocalStorage();
  const {
    MATCH_FEEDBACK_STORAGE_KEY,
    loadMatchFeedback,
    recordMatchFeedbackEvent
  } = await import('../src/matchFeedback.js');

  recordMatchFeedbackEvent(issue(), 'saved', storage, { now: '2026-05-23T12:00:00.000Z' });
  recordMatchFeedbackEvent(issue(), 'saved', storage, { now: '2026-05-23T12:05:00.000Z' });
  recordMatchFeedbackEvent(issue(), 'entered:Working', storage, { now: '2026-05-23T12:10:00.000Z' });

  const feedback = loadMatchFeedback(storage);
  const raw = storage.getItem(MATCH_FEEDBACK_STORAGE_KEY);

  assert.equal(Object.keys(feedback.events).length, 2);
  assert.equal(feedback.totals.saved, 1);
  assert.equal(feedback.totals.working, 1);
  assert.equal(feedback.buckets.languages.TypeScript.saved, 1);
  assert.equal(feedback.buckets.languages.TypeScript.working, 1);
  assert.equal(feedback.buckets.workTypes.docs.saved, 1);
  assert.doesNotMatch(raw, /Fix README setup command|Expected behavior|token|secret/i);
});

test('match feedback records hidden issue and hidden repo as negative events once', async () => {
  const storage = createLocalStorage();
  const { loadMatchFeedback, recordMatchFeedbackEvent } = await import('../src/matchFeedback.js');

  recordMatchFeedbackEvent(issue(), 'hiddenIssue', storage, { now: '2026-05-23T12:00:00.000Z' });
  recordMatchFeedbackEvent(issue(), 'hiddenIssue', storage, { now: '2026-05-23T12:01:00.000Z' });
  recordMatchFeedbackEvent(issue(), 'hiddenRepo', storage, { now: '2026-05-23T12:02:00.000Z' });

  const feedback = loadMatchFeedback(storage);

  assert.equal(feedback.totals.hiddenIssue, 1);
  assert.equal(feedback.totals.hiddenRepo, 1);
  assert.equal(feedback.buckets.repo['teammates/teammates'].hiddenRepo, 1);
});

test('match feedback merge dedupes event markers and accepts legacy counters conservatively', async () => {
  const {
    createEmptyMatchFeedback,
    mergeMatchFeedback,
    recordMatchFeedbackEvent
  } = await import('../src/matchFeedback.js');
  const storage = createLocalStorage();

  const current = recordMatchFeedbackEvent(issue(), 'saved', storage, { now: '2026-05-23T12:00:00.000Z' });
  const merged = mergeMatchFeedback(current, {
    version: 1,
    totals: { saved: 2, passed: 1 },
    events: {
      'teammates/teammates#13997|saved': {
        at: '2026-05-23T12:00:00.000Z',
        action: 'saved'
      }
    }
  });

  assert.equal(merged.totals.saved, 3);
  assert.equal(merged.totals.passed, 1);
  assert.equal(Object.keys(merged.events).filter(key => key.endsWith('|saved')).length, 1);
  assert.deepEqual(createEmptyMatchFeedback().totals, {
    saved: 0,
    working: 0,
    passed: 0,
    merged: 0,
    hiddenIssue: 0,
    hiddenRepo: 0
  });
});

test('match feedback save/load/clear round trip', async () => {
  const storage = createLocalStorage();
  const {
    clearMatchFeedback,
    loadMatchFeedback,
    recordMatchFeedbackEvent
  } = await import('../src/matchFeedback.js');

  recordMatchFeedbackEvent(issue(), 'entered:Merged', storage, { now: '2026-05-23T12:00:00.000Z' });
  assert.equal(loadMatchFeedback(storage).totals.merged, 1);

  clearMatchFeedback(storage);
  assert.equal(loadMatchFeedback(storage).totals.merged, 0);
});
