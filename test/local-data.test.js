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

test('exported local data excludes token and repo metadata cache', async () => {
  const storage = createLocalStorage();
  const { exportLocalData } = await import('../src/localData.js');
  storage.setItem('pr_dashboard_token', 'secret-token');
  storage.setItem('pr_dashboard_repo_metadata_cache_v1', JSON.stringify({ 'owner/repo': { stargazers_count: 1 } }));
  storage.setItem('pr_dashboard_board_cards', JSON.stringify({ Considering: [{ id: 1, number: 1, repository: { full_name: 'Owner/Repo' } }] }));
  storage.setItem('pr_dashboard_profile_v1', JSON.stringify({
    version: 1,
    github_id: '12345',
    login: 'Statusnone420',
    name: 'Anthony Stone',
    github_url: 'https://github.com/Statusnone420',
    avatar_url: 'https://avatars.githubusercontent.com/u/123?v=4',
    saved_at: '2026-05-22T11:00:00.000Z'
  }));

  const exported = exportLocalData(storage, { now: '2026-05-22T12:00:00.000Z' });

  assert.equal(exported.version, 1);
  assert.equal(exported.exported_at, '2026-05-22T12:00:00.000Z');
  assert.equal(exported.profile.avatar_url, 'https://avatars.githubusercontent.com/u/123?v=4');
  assert.equal(exported.token, undefined);
  assert.equal(exported.repoMetadata, undefined);
  assert.doesNotMatch(JSON.stringify(exported), /secret-token|repo_metadata_cache/i);
});

test('export and import preserve GitHub activity acknowledgement as board metadata', async () => {
  const sourceStorage = createLocalStorage();
  const targetStorage = createLocalStorage();
  const { exportLocalData, importLocalData } = await import('../src/localData.js');
  sourceStorage.setItem('pr_dashboard_board_cards', JSON.stringify({
    Considering: [{
      id: 13997,
      number: 13997,
      title: 'Changed issue',
      repository: { full_name: 'TEAMMATES/teammates' },
      column_entered_at: '2026-05-22T10:00:00.000Z',
      github_activity: {
        has_new_activity: true,
        last_checked_at: '2026-05-22T10:00:00.000Z',
        acknowledged_at: '2026-05-22T10:05:00.000Z',
        summary: '2 new comments since last refresh.'
      }
    }]
  }));

  const exported = exportLocalData(sourceStorage, { now: '2026-05-22T12:00:00.000Z' });
  importLocalData(targetStorage, exported);
  const importedBoard = JSON.parse(targetStorage.getItem('pr_dashboard_board_cards'));

  assert.equal(exported.boardCards.Considering[0].github_activity.acknowledged_at, '2026-05-22T10:05:00.000Z');
  assert.equal(importedBoard.Considering[0].github_activity.acknowledged_at, '2026-05-22T10:05:00.000Z');
  assert.equal(importedBoard.Considering[0].github_activity.summary, '2 new comments since last refresh.');
});

test('import collisions keep newer GitHub activity and drop stale acknowledgements', async () => {
  const storage = createLocalStorage();
  const { importLocalData } = await import('../src/localData.js');
  storage.setItem('pr_dashboard_board_cards', JSON.stringify({
    Considering: [{
      id: 13997,
      number: 13997,
      title: 'Local newer activity',
      repository: { full_name: 'TEAMMATES/teammates' },
      column_entered_at: '2026-05-20T10:00:00.000Z',
      github_activity: {
        has_new_activity: true,
        last_checked_at: '2026-05-22T12:00:00.000Z',
        summary: '4 new comments since last refresh.',
        acknowledged_at: '2026-05-22T11:00:00.000Z'
      }
    }]
  }));

  importLocalData(storage, {
    version: 1,
    boardCards: {
      Working: [{
        id: 99,
        number: 13997,
        title: 'Imported newer workflow',
        repository: { full_name: 'teammates/teammates' },
        column_entered_at: '2026-05-22T10:00:00.000Z',
        github_activity: {
          has_new_activity: true,
          last_checked_at: '2026-05-21T12:00:00.000Z',
          summary: '1 new comment since last refresh.',
          acknowledged_at: '2026-05-21T12:05:00.000Z'
        }
      }]
    }
  });

  const board = JSON.parse(storage.getItem('pr_dashboard_board_cards'));
  assert.equal(board.Working[0].title, 'Imported newer workflow');
  assert.equal(board.Working[0].github_activity.last_checked_at, '2026-05-22T12:00:00.000Z');
  assert.equal(board.Working[0].github_activity.summary, '4 new comments since last refresh.');
  assert.equal(board.Working[0].github_activity.acknowledged_at, undefined);
});

test('imported local data ignores token and repo metadata cache fields', async () => {
  const storage = createLocalStorage();
  const { importLocalData } = await import('../src/localData.js');

  importLocalData(storage, {
    version: 1,
    token: 'imported-secret-token',
    rememberToken: true,
    repoMetadata: { 'owner/repo': { stargazers_count: 999 } },
    boardCards: {
      Considering: [{
        id: 1,
        number: 1,
        title: 'Portable card',
        repository: { full_name: 'Owner/Repo' }
      }]
    }
  });

  assert.equal(storage.getItem('pr_dashboard_token'), null);
  assert.equal(storage.getItem('pr_dashboard_remember_token'), null);
  assert.equal(storage.getItem('pr_dashboard_repo_metadata_cache_v1'), null);
});

test('import merges board cards by canonical issue before numeric id and keeps one lane', async () => {
  const storage = createLocalStorage();
  const { importLocalData } = await import('../src/localData.js');
  storage.setItem('pr_dashboard_board_cards', JSON.stringify({
    Considering: [{
      id: 1,
      number: 13997,
      title: 'Older workflow',
      repository: { full_name: 'TEAMMATES/teammates' },
      column_entered_at: '2026-05-20T12:00:00.000Z'
    }],
    Working: [],
    Merged: []
  }));

  importLocalData(storage, {
    version: 1,
    boardCards: {
      Working: [{
        id: 99,
        number: 13997,
        title: 'Newer workflow',
        repository: { full_name: 'teammates/teammates' },
        column_entered_at: '2026-05-22T12:00:00.000Z'
      }]
    }
  });

  const board = JSON.parse(storage.getItem('pr_dashboard_board_cards'));
  const allCards = Object.values(board).flat();
  assert.equal(allCards.length, 1);
  assert.equal(board.Working[0].title, 'Newer workflow');
  assert.equal(board.Considering.length, 0);
});

test('import merges hidden items by key and keeps newest hidden timestamp', async () => {
  const storage = createLocalStorage();
  const { importLocalData } = await import('../src/localData.js');
  storage.setItem('pr_dashboard_hidden_v1', JSON.stringify({
    version: 1,
    issues: {
      'owner/repo#1': 100,
      'owner/repo#2': 400
    },
    repos: {
      'owner/repo': 200
    }
  }));

  const result = importLocalData(storage, {
    version: 1,
    hiddenItems: {
      version: 1,
      issues: {
        'owner/repo#1': 300,
        'owner/repo#3': 250
      },
      repos: {
        'owner/repo': 150,
        'other/repo': 500
      }
    }
  });

  const hidden = JSON.parse(storage.getItem('pr_dashboard_hidden_v1'));
  assert.equal(hidden.issues['owner/repo#1'], 300);
  assert.equal(hidden.issues['owner/repo#2'], 400);
  assert.equal(hidden.issues['owner/repo#3'], 250);
  assert.equal(hidden.repos['owner/repo'], 200);
  assert.equal(hidden.repos['other/repo'], 500);
  assert.deepEqual(result.hiddenItems, hidden);
});

test('import merges proof log entries without wiping newer local history', async () => {
  const storage = createLocalStorage();
  const { importLocalData } = await import('../src/localData.js');
  storage.setItem('pr_dashboard_proof_log_v1', JSON.stringify({
    version: 1,
    entries: {
      'owner/repo#1': {
        key: 'owner/repo#1',
        type: 'issue',
        status: 'marked_complete',
        source: 'manual_lookup',
        completed_at: '2026-05-20T10:00:00.000Z',
        created_at: '2026-05-20T10:00:00.000Z',
        updated_at: '2026-05-21T10:00:00.000Z',
        last_seen_at: '2026-05-21T10:00:00.000Z',
        note: 'Local note',
        snapshot: { title: 'Local title', repo: 'owner/repo', display_key: 'owner/repo#1', number: 1, checklist: [], progress: 25, board_column: 'Merged' }
      },
      'owner/repo#2': {
        key: 'owner/repo#2',
        type: 'pull',
        status: 'marked_complete',
        source: 'manual_lookup',
        completed_at: '2026-05-19T10:00:00.000Z',
        created_at: '2026-05-19T10:00:00.000Z',
        updated_at: '2026-05-19T10:00:00.000Z',
        last_seen_at: '2026-05-19T10:00:00.000Z',
        note: 'Keep local only',
        snapshot: { title: 'Local only', repo: 'owner/repo', display_key: 'owner/repo#2', number: 2, checklist: [], progress: 100, board_column: 'Merged' }
      }
    }
  }));

  const result = importLocalData(storage, {
    version: 1,
    proofLog: {
      version: 1,
      entries: {
        'owner/repo#1': {
          key: 'owner/repo#1',
          type: 'issue',
          status: 'reviewed',
          source: 'manual_import',
          completed_at: '2026-05-22T10:00:00.000Z',
          created_at: '2026-05-22T10:00:00.000Z',
          updated_at: '2026-05-22T11:00:00.000Z',
          last_seen_at: '2026-05-22T11:00:00.000Z',
          note: 'Imported newer note',
          snapshot: { title: 'Imported title', repo: 'owner/repo', display_key: 'owner/repo#1', number: 1, checklist: [], progress: 80, board_column: 'Passed' }
        },
        'owner/repo#3': {
          key: 'owner/repo#3',
          type: 'issue',
          status: 'marked_complete',
          source: 'manual_import',
          completed_at: '2026-05-18T10:00:00.000Z',
          created_at: '2026-05-18T10:00:00.000Z',
          updated_at: '2026-05-18T10:00:00.000Z',
          last_seen_at: '2026-05-18T10:00:00.000Z',
          note: 'Imported only',
          snapshot: { title: 'Imported only', repo: 'owner/repo', display_key: 'owner/repo#3', number: 3, checklist: [], progress: 100, board_column: 'Passed' }
        }
      }
    }
  });

  const proofLog = JSON.parse(storage.getItem('pr_dashboard_proof_log_v1'));
  assert.equal(proofLog.entries['owner/repo#1'].completed_at, '2026-05-20T10:00:00.000Z');
  assert.equal(proofLog.entries['owner/repo#1'].created_at, '2026-05-20T10:00:00.000Z');
  assert.equal(proofLog.entries['owner/repo#1'].updated_at, '2026-05-22T11:00:00.000Z');
  assert.equal(proofLog.entries['owner/repo#1'].note, 'Imported newer note');
  assert.equal(proofLog.entries['owner/repo#1'].status, 'reviewed');
  assert.equal(proofLog.entries['owner/repo#1'].snapshot.title, 'Imported title');
  assert.equal(proofLog.entries['owner/repo#2'].note, 'Keep local only');
  assert.equal(proofLog.entries['owner/repo#3'].note, 'Imported only');
  assert.deepEqual(result.proofLog, proofLog);
});

test('import keeps newer profile and returns retained merged data for UI state', async () => {
  const storage = createLocalStorage();
  const { importLocalData } = await import('../src/localData.js');
  storage.setItem('pr_dashboard_profile_v1', JSON.stringify({
    version: 1,
    github_id: '12345',
    login: 'local-user',
    name: 'Local User',
    github_url: 'https://github.com/local-user',
    avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    saved_at: '2026-05-22T12:00:00.000Z'
  }));

  const result = importLocalData(storage, {
    version: 1,
    profile: {
      version: 1,
      github_id: '999',
      login: 'old-import',
      name: 'Old Import',
      github_url: 'https://github.com/old-import',
      avatar_url: 'https://avatars.githubusercontent.com/u/999?v=4',
      saved_at: '2026-05-21T12:00:00.000Z'
    }
  });

  const storedProfile = JSON.parse(storage.getItem('pr_dashboard_profile_v1'));
  assert.equal(storedProfile.login, 'local-user');
  assert.equal(storedProfile.saved_at, '2026-05-22T12:00:00.000Z');
  assert.equal(result.profile.login, 'local-user');
});
