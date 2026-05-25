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
  assert.match(globalThis.localStorage.getItem('pr_dashboard_match_feedback_v1'), /entered:Merged/);
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

test('moving a card to Passed clears matching proof log entry', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { listProofEntries } = await import('../src/proofLog.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 13997,
    number: 13997,
    title: 'Closed but not completed',
    state: 'closed',
    state_reason: 'completed',
    repository: { full_name: 'TEAMMATES/teammates' },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13997'
  });
  appStore.addIssueToProofLog(appStore.boardCards.Considering[0], {
    source: 'board_merged',
    boardColumn: 'Merged'
  });

  appStore.moveCardToColumn(13997, 'Passed');

  assert.equal(appStore.boardCards.Passed[0].id, 13997);
  assert.equal(listProofEntries(globalThis.localStorage).length, 0);
  assert.match(globalThis.localStorage.getItem('pr_dashboard_match_feedback_v1'), /entered:Passed/);
  assert.match(globalThis.localStorage.getItem('pr_dashboard_hidden_v1'), /teammates\/teammates#13997/);
});

test('moving a card out of Passed with moveCardToColumn unhides the exact issue', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { filterHiddenIssues } = await import('../src/hiddenItems.js');

  const appStore = new AppStore();
  const target = {
    id: 13997,
    number: 13997,
    title: 'Restore passed issue',
    repository: { full_name: 'TEAMMATES/teammates' },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13997'
  };

  appStore.saveIssueToBoard(target);
  appStore.moveCardToColumn(13997, 'Passed');
  assert.equal(filterHiddenIssues([target], globalThis.localStorage).length, 0);

  appStore.moveCardToColumn(13997, 'Working');

  assert.equal(appStore.boardCards.Working[0].id, 13997);
  assert.equal(filterHiddenIssues([target], globalThis.localStorage).length, 1);
});

test('moving a card out of Passed with moveBoardCard unhides the exact issue', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { filterHiddenIssues } = await import('../src/hiddenItems.js');

  const appStore = new AppStore();
  const target = {
    id: 13998,
    number: 13998,
    title: 'Restore passed issue with arrows',
    repository: { full_name: 'TEAMMATES/teammates' },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13998'
  };

  appStore.saveIssueToBoard(target);
  appStore.moveCardToColumn(13998, 'Passed');
  assert.equal(filterHiddenIssues([target], globalThis.localStorage).length, 0);

  appStore.moveBoardCard(13998, -1);

  assert.equal(appStore.boardCards.Merged[0].id, 13998);
  assert.equal(filterHiddenIssues([target], globalThis.localStorage).length, 1);
});

test('moving a manually hidden card out of Passed keeps the exact issue hidden', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { filterHiddenIssues } = await import('../src/hiddenItems.js');

  const appStore = new AppStore();
  const target = {
    id: 13999,
    number: 13999,
    title: 'Manual hide survives pass reversal',
    repository: { full_name: 'TEAMMATES/teammates' },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13999'
  };

  appStore.saveIssueToBoard(target);
  appStore.hideIssue(target);
  appStore.moveCardToColumn(13999, 'Passed');
  appStore.moveCardToColumn(13999, 'Working');

  assert.equal(appStore.boardCards.Working[0].id, 13999);
  assert.equal(filterHiddenIssues([target], globalThis.localStorage).length, 0);
});

test('removing a manually hidden Passed board card keeps the exact issue hidden', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { filterHiddenIssues } = await import('../src/hiddenItems.js');

  const appStore = new AppStore();
  const target = {
    id: 3580,
    number: 3580,
    title: 'Remove manually hidden passed candidate',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/3580'
  };

  appStore.saveIssueToBoard(target);
  appStore.hideIssue(target);
  appStore.moveCardToColumn(3580, 'Passed');
  appStore.removeBoardCard(3580);

  assert.equal(Object.values(appStore.boardCards).flat().length, 0);
  assert.equal(filterHiddenIssues([target], globalThis.localStorage).length, 0);
});

test('manually hiding an already Passed card keeps the exact issue hidden when moved back', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { filterHiddenIssues } = await import('../src/hiddenItems.js');

  const appStore = new AppStore();
  const target = {
    id: 3581,
    number: 3581,
    title: 'Manual hide after pass survives reversal',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/3581'
  };

  appStore.saveIssueToBoard(target);
  appStore.moveCardToColumn(3581, 'Passed');
  appStore.hideIssue(target);
  appStore.moveCardToColumn(3581, 'Working');

  assert.equal(appStore.boardCards.Working[0].id, 3581);
  assert.equal(filterHiddenIssues([target], globalThis.localStorage).length, 0);
});

test('removing a board card does not hide or pass the issue', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  appStore.saveIssueToBoard({
    id: 2468,
    number: 2468,
    title: 'Remove without passing',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/2468'
  });

  appStore.removeBoardCard(2468);

  assert.equal(Object.values(appStore.boardCards).flat().length, 0);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_hidden_v1'), null);
  assert.doesNotMatch(globalThis.localStorage.getItem('pr_dashboard_match_feedback_v1'), /entered:Passed/);
});

test('removing a Passed board card unhides the exact issue', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');
  const { filterHiddenIssues } = await import('../src/hiddenItems.js');

  const appStore = new AppStore();
  const target = {
    id: 3579,
    number: 3579,
    title: 'Remove passed candidate',
    repository: { full_name: 'openai/codex' },
    html_url: 'https://github.com/openai/codex/issues/3579'
  };

  appStore.saveIssueToBoard(target);
  appStore.moveCardToColumn(3579, 'Passed');
  assert.equal(filterHiddenIssues([target], globalThis.localStorage).length, 0);

  appStore.removeBoardCard(3579);

  assert.equal(Object.values(appStore.boardCards).flat().length, 0);
  assert.equal(filterHiddenIssues([target], globalThis.localStorage).length, 1);
});

test('save, repeated save, Working move, and hide actions record feedback once', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  const target = {
    id: 13997,
    number: 13997,
    title: 'Feedback issue',
    body: 'Expected behavior: update README docs and tests.',
    labels: [{ name: 'documentation' }],
    repository: { full_name: 'TEAMMATES/teammates', language: 'TypeScript' },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/13997'
  };

  appStore.saveIssueToBoard(target);
  appStore.saveIssueToBoard(target);
  appStore.moveCardToColumn(13997, 'Working');
  appStore.moveCardToColumn(13997, 'Working');
  appStore.hideIssue(target);
  appStore.hideIssue(target);
  appStore.hideRepo(target);
  appStore.hideRepo(target);

  const feedback = JSON.parse(globalThis.localStorage.getItem('pr_dashboard_match_feedback_v1'));
  assert.equal(feedback.totals.saved, 1);
  assert.equal(feedback.totals.working, 1);
  assert.equal(feedback.totals.hiddenIssue, 1);
  assert.equal(feedback.totals.hiddenRepo, 1);
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
  appStore.updateContributionPreferences({
    languages: ['TypeScript'],
    preferredWork: ['docs'],
    saved_at: '2026-05-23T12:00:00.000Z'
  }, { notify: false });
  globalThis.localStorage.setItem('pr_dashboard_score_enrichment_cache_v1', JSON.stringify({
    version: 1,
    entries: { 'teammates/teammates#13997': { summary: { inspected: true } } }
  }));
  appStore.saveIssueToBoard({
    id: 14000,
    number: 14000,
    title: 'Feedback stays',
    repository: { full_name: 'TEAMMATES/teammates', language: 'TypeScript' },
    html_url: 'https://github.com/TEAMMATES/teammates/issues/14000'
  });
  appStore.updateToken('sample-token', true);

  appStore.clearToken();

  assert.equal(globalThis.localStorage.getItem('pr_dashboard_token'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_profile_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_score_enrichment_cache_v1'), null);
  assert.match(globalThis.localStorage.getItem('pr_dashboard_contribution_preferences_v1'), /TypeScript/);
  assert.match(globalThis.localStorage.getItem('pr_dashboard_match_feedback_v1'), /saved/);
  assert.equal(appStore.contributionPreferences.languages[0], 'TypeScript');
  assert.equal(Object.values(appStore.boardCards).flat().length, 2);
  assert.equal(listProofEntries(globalThis.localStorage).length, 1);
});

test('clearing all local app data removes proof, profile, hidden, preferences, and caches', async () => {
  globalThis.localStorage = createLocalStorage();
  const { AppStore } = await import('../src/state/store.js');

  const appStore = new AppStore();
  globalThis.localStorage.setItem('pr_dashboard_remember_token', 'true');
  globalThis.localStorage.setItem('pr_dashboard_token', 'sample-token');
  globalThis.localStorage.setItem('pr_dashboard_board_migration_v1', 'board-cleared-by-user');
  globalThis.localStorage.setItem('pr_dashboard_proof_log_v1', JSON.stringify({ version: 1, entries: {} }));
  globalThis.localStorage.setItem('pr_dashboard_profile_v1', JSON.stringify({ version: 1, login: 'Statusnone420' }));
  globalThis.localStorage.setItem('pr_dashboard_contribution_preferences_v1', JSON.stringify({ version: 1, languages: ['TypeScript'], saved_at: '2026-05-23T12:00:00.000Z' }));
  globalThis.localStorage.setItem('pr_dashboard_match_feedback_v1', JSON.stringify({ version: 1, events: {} }));
  globalThis.localStorage.setItem('pr_dashboard_score_enrichment_cache_v1', JSON.stringify({ version: 1, entries: {} }));
  globalThis.localStorage.setItem('pr_dashboard_hidden_v1', JSON.stringify({ version: 1, issues: {}, repos: {} }));
  globalThis.localStorage.setItem('pr_dashboard_repo_metadata_cache_v1', JSON.stringify({ 'owner/repo': {} }));

  appStore.clearAllLocalData();

  assert.equal(globalThis.localStorage.getItem('pr_dashboard_board_cards'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_board_migration_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_remember_token'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_token'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_proof_log_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_profile_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_contribution_preferences_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_match_feedback_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_score_enrichment_cache_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_hidden_v1'), null);
  assert.equal(globalThis.localStorage.getItem('pr_dashboard_repo_metadata_cache_v1'), null);
  assert.equal(appStore.contributionPreferences, null);
  assert.equal(appStore.matchFeedback.totals.saved, 0);
});
