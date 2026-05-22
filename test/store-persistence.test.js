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

test('board cards persist after save and column moves', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const firstStore = new AppStore();
  firstStore.boardCards = {
    Considering: [],
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: []
  };

  firstStore.saveIssueToBoard({
    id: 987654321,
    number: 42,
    title: 'Safe public issue',
    body: 'Issue body',
    updated_at: '2026-05-20T00:00:00Z',
    labels: [],
    comments: 0,
    repository: {
      name: 'example',
      full_name: 'openai/example',
      stargazers_count: 1000
    },
    html_url: 'https://github.com/openai/example/issues/42'
  });
  firstStore.moveBoardCard(987654321, 1);

  const secondStore = new AppStore();
  assert.equal(secondStore.boardCards.Considering.some(card => card.id === 987654321), false);
  assert.equal(secondStore.boardCards['Read Docs'].some(card => card.id === 987654321), true);
});

test('clearing token does not wipe persisted board cards', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.boardCards = {
    Considering: [{ id: 123, title: 'Keep me' }],
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: []
  };
  appStore.saveBoardToStorage();
  appStore.updateToken(['sample', 'credential'].join('-'), true);

  appStore.clearToken();

  assert.equal(globalThis.localStorage.getItem('pr_dashboard_token'), null);
  assert.match(globalThis.localStorage.getItem('pr_dashboard_board_cards'), /Keep me/);
});

test('normal production startup does not seed mock board cards', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  const totalCards = Object.values(appStore.boardCards).flat().length;

  assert.equal(totalCards, 0);
});

test('old seeded mock board cards are removed during board migration', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { mockBoardCards } = await import('../src/data/mockData.js');

  globalThis.localStorage.setItem('pr_dashboard_board_cards', JSON.stringify(mockBoardCards));

  const appStore = new AppStore();
  const allCards = Object.values(appStore.boardCards).flat();

  assert.equal(allCards.length, 0);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_board_migration_v1'), 'seeded-mock-cards-removed');
});

test('hiding an issue keeps saved board cards for recovery and proof history', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 1,
    number: 10,
    title: 'Hide me',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });
  appStore.saveIssueToBoard({
    id: 2,
    number: 11,
    title: 'Keep me',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/11'
  });

  appStore.hideIssue({
    id: 1,
    number: 10,
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });

  const remaining = Object.values(appStore.boardCards).flat();
  assert.deepEqual(remaining.map(card => card.id), [1, 2]);
});

test('hiding a repo keeps saved board cards for recovery and proof history', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 1,
    number: 10,
    title: 'Repo hide me',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });
  appStore.saveIssueToBoard({
    id: 2,
    number: 20,
    title: 'Other repo',
    repository: { full_name: 'vercel/next.js' },
    html_url: 'https://github.com/vercel/next.js/issues/20'
  });

  appStore.hideRepo({
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });

  const remaining = Object.values(appStore.boardCards).flat();
  assert.deepEqual(remaining.map(card => card.id), [1, 2]);
});

test('new saved issues get local workflow timestamps', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 1,
    number: 10,
    title: 'Timestamp me',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/10'
  });

  const card = appStore.boardCards.Considering[0];
  assert.match(card.last_moved_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(card.column_entered_at, card.last_moved_at);
});

test('moving to Merged through moveBoardCard creates proof log entry and stamps movement', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { listProofEntries } = await import('../src/proofLog.js');

  const appStore = new AppStore();
  appStore.boardCards = {
    Considering: [],
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [{
      id: 13998,
      number: 13998,
      title: 'Merged PR',
      repository: { full_name: 'TEAMMATES/teammates' },
      html_url: 'https://github.com/TEAMMATES/teammates/pull/13998'
    }],
    Merged: [],
    Passed: []
  };

  appStore.moveBoardCard(13998, 1);

  assert.equal(appStore.boardCards.Merged[0].last_moved_at, appStore.boardCards.Merged[0].column_entered_at);
  assert.equal(listProofEntries(globalThis.localStorage)[0].key, 'teammates/teammates#13998');
  assert.equal(listProofEntries(globalThis.localStorage)[0].source, 'board_merged');
});

test('moving to Merged through moveCardToColumn creates proof log entry', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { listProofEntries } = await import('../src/proofLog.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 13997,
    number: 13997,
    title: 'Merged issue',
    repository: { full_name: 'TEAMMATES/teammates' },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13997'
  });

  appStore.moveCardToColumn(13997, 'Merged');

  assert.equal(listProofEntries(globalThis.localStorage)[0].key, 'teammates/teammates#13997');
});

test('marking GitHub activity reviewed stamps acknowledgement without clearing summary', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.boardCards = {
    Considering: [{
      id: 13997,
      number: 13997,
      title: 'Changed issue',
      repository: { full_name: 'TEAMMATES/teammates' },
      github_activity: {
        has_new_activity: true,
        last_checked_at: '2026-05-22T10:00:00.000Z',
        summary: '2 new comments since last refresh.'
      }
    }],
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: []
  };
  appStore.setInspectedIssue(appStore.boardCards.Considering[0]);

  const updated = appStore.markGitHubActivityReviewed(13997, '2026-05-22T10:05:00.000Z');

  assert.equal(updated.github_activity.acknowledged_at, '2026-05-22T10:05:00.000Z');
  assert.equal(updated.github_activity.summary, '2 new comments since last refresh.');
  assert.equal(appStore.inspectedIssue.github_activity.acknowledged_at, '2026-05-22T10:05:00.000Z');
  assert.match(globalThis.localStorage.getItem('pr_dashboard_board_cards'), /acknowledged_at/);
  assert.match(globalThis.localStorage.getItem('pr_dashboard_board_cards'), /2 new comments since last refresh/);
});

test('inspector checklist toggles persist for saved cards outside Working', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.boardCards = {
    Considering: [{
      id: 13997,
      number: 13997,
      title: 'Checklist outside working',
      repository: { full_name: 'TEAMMATES/teammates' },
      checklist: [
        { text: 'Confirm scope', completed: false },
        { text: 'Run tests', completed: false }
      ],
      progress: 0
    }],
    'Read Docs': [],
    'Asked Maintainer': [],
    Working: [],
    'PR Open': [],
    Merged: [],
    Passed: []
  };
  appStore.setInspectedIssue(appStore.boardCards.Considering[0]);

  appStore.toggleTaskChecklist(13997, 'Confirm scope', true);

  const storedBoard = JSON.parse(globalThis.localStorage.getItem('pr_dashboard_board_cards'));
  assert.equal(storedBoard.Considering[0].checklist[0].completed, true);
  assert.equal(storedBoard.Considering[0].progress, 50);
  assert.equal(appStore.boardCards.Considering[0].checklist[0].completed, true);
  assert.equal(appStore.boardCards.Considering[0].progress, 50);
  assert.equal(appStore.inspectedIssue.checklist[0].completed, true);
  assert.equal(appStore.inspectedIssue.progress, 50);
});

test('clearing board data keeps proof log history', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { listProofEntries } = await import('../src/proofLog.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 13997,
    number: 13997,
    title: 'Keep proof after board clear',
    repository: { full_name: 'TEAMMATES/teammates' },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13997'
  });
  appStore.addIssueToProofLog(appStore.boardCards.Considering[0], { source: 'manual_lookup' });

  appStore.clearBoard();

  assert.equal(Object.values(appStore.boardCards).flat().length, 0);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_board_cards'), null);
  assert.equal(listProofEntries(globalThis.localStorage).length, 1);
  assert.equal(listProofEntries(globalThis.localStorage)[0].key, 'teammates/teammates#13997');
});

test('clearing token and settings clears profile but keeps board and proof log', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { listProofEntries } = await import('../src/proofLog.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 13997,
    number: 13997,
    title: 'Keep proof',
    repository: { full_name: 'TEAMMATES/teammates' },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13997'
  });
  appStore.addIssueToProofLog(appStore.boardCards.Considering[0], { source: 'manual_lookup' });
  appStore.updateProfileFromGitHubUser({ login: 'Statusnone420', html_url: 'https://github.com/Statusnone420' }, { notify: false });
  appStore.updateToken('sample-token', true);

  appStore.clearToken();

  assert.equal(globalThis.localStorage.getItem('pr_dashboard_token'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_profile_v1'), null);
  assert.equal(Object.values(appStore.boardCards).flat().length, 1);
  assert.equal(listProofEntries(globalThis.localStorage).length, 1);
});

test('clearing all local app data removes proof, profile, hidden, and repo metadata cache', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  globalThis.localStorage.setItem('pr_dashboard_remember_token', 'true');
  globalThis.localStorage.setItem('pr_dashboard_token', 'sample-token');
  globalThis.localStorage.setItem('pr_dashboard_board_migration_v1', 'board-cleared-by-user');
  globalThis.localStorage.setItem('pr_dashboard_proof_log_v1', JSON.stringify({ version: 1, entries: {} }));
  globalThis.localStorage.setItem('pr_dashboard_profile_v1', JSON.stringify({ version: 1, login: 'Statusnone420' }));
  globalThis.localStorage.setItem('pr_dashboard_hidden_v1', JSON.stringify({ version: 1, issues: {}, repos: {} }));
  globalThis.localStorage.setItem('pr_dashboard_repo_metadata_cache_v1', JSON.stringify({ 'owner/repo': {} }));

  appStore.clearAllLocalData();

  assert.equal(globalThis.localStorage.getItem('pr_dashboard_board_cards'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_board_migration_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_remember_token'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_token'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_proof_log_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_profile_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_hidden_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_repo_metadata_cache_v1'), null);
});
