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

function teammatesIssue(overrides = {}) {
  return {
    id: 13997,
    number: 13997,
    title: 'Replace JSON parse clones',
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13997',
    repository: { full_name: 'TEAMMATES/teammates' },
    checklist: [{ text: 'Verify locally', completed: true }],
    progress: 100,
    ...overrides
  };
}

test('proof log upsert preserves original completion and creation dates', async () => {
  const storage = createLocalStorage();
  const { listProofEntries, upsertProofEntry, createProofEntryFromIssue } = await import('../src/proofLog.js');

  upsertProofEntry(
    createProofEntryFromIssue(teammatesIssue(), {
      source: 'board_merged',
      completedAt: '2026-05-22T10:00:00.000Z',
      now: '2026-05-22T10:00:00.000Z'
    }),
    storage
  );
  upsertProofEntry(
    createProofEntryFromIssue(teammatesIssue({ title: 'Updated title' }), {
      source: 'manual_lookup',
      completedAt: '2026-05-23T10:00:00.000Z',
      now: '2026-05-23T10:00:00.000Z'
    }),
    storage
  );

  const [entry] = listProofEntries(storage);
  assert.equal(entry.key, 'teammates/teammates#13997');
  assert.equal(entry.completed_at, '2026-05-22T10:00:00.000Z');
  assert.equal(entry.created_at, '2026-05-22T10:00:00.000Z');
  assert.equal(entry.updated_at, '2026-05-23T10:00:00.000Z');
  assert.equal(entry.last_seen_at, '2026-05-23T10:00:00.000Z');
  assert.equal(entry.snapshot.title, 'Updated title');
});

test('proof entries created from merged board cards are local marked-complete records', async () => {
  const { createProofEntryFromIssue } = await import('../src/proofLog.js');
  const entry = createProofEntryFromIssue(teammatesIssue(), {
    source: 'startup_backfill',
    boardColumn: 'Merged',
    now: '2026-05-22T12:00:00.000Z'
  });

  assert.equal(entry.status, 'marked_complete');
  assert.equal(entry.source, 'startup_backfill');
  assert.equal(entry.completed_at, '2026-05-22T12:00:00.000Z');
  assert.equal(entry.snapshot.board_column, 'Merged');
  assert.equal(entry.snapshot.repo, 'TEAMMATES/teammates');
});

test('proof log storage never includes token-shaped unrelated local values', async () => {
  const storage = createLocalStorage();
  const { PROOF_LOG_STORAGE_KEY, upsertProofEntry, createProofEntryFromIssue } = await import('../src/proofLog.js');
  storage.setItem('pr_dashboard_token', 'secret-token');

  upsertProofEntry(createProofEntryFromIssue(teammatesIssue(), { now: '2026-05-22T12:00:00.000Z' }), storage);

  assert.doesNotMatch(storage.getItem(PROOF_LOG_STORAGE_KEY), /secret-token|pr_dashboard_token/i);
});
