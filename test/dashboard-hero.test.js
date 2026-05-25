import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyBoard } from '../src/boardModel.js';
import { getDashboardHeroRecommendation, getDashboardSavedPreviewCards } from '../src/dashboardHero.js';

function issue(id, overrides = {}) {
  return {
    id,
    title: `Issue ${id}`,
    state: 'open',
    number: id,
    repository: { full_name: 'owner/repo' },
    ...overrides
  };
}

test('no token and no active issue recommends PAT setup', () => {
  const recommendation = getDashboardHeroRecommendation({
    boardCards: createEmptyBoard(),
    githubToken: ''
  });

  assert.equal(recommendation.kind, 'configure-token');
});

test('configured token and no active issue recommends finding contributions', () => {
  const recommendation = getDashboardHeroRecommendation({
    boardCards: createEmptyBoard(),
    githubToken: '  sample-token  '
  });

  assert.equal(recommendation.kind, 'find-contributions');
});

test('active saved issue outside Considering and Working is resumable', () => {
  const boardCards = createEmptyBoard();
  boardCards['Read Docs'].push(issue(10));

  const recommendation = getDashboardHeroRecommendation({
    boardCards,
    githubToken: 'sample-token'
  });

  assert.equal(recommendation.kind, 'resume');
  assert.equal(recommendation.card.id, 10);
  assert.equal(recommendation.column, 'Read Docs');
});

test('active saved issue takes priority over missing token', () => {
  const boardCards = createEmptyBoard();
  boardCards['PR Open'].push(issue(20));

  const recommendation = getDashboardHeroRecommendation({
    boardCards,
    githubToken: ''
  });

  assert.equal(recommendation.kind, 'resume');
  assert.equal(recommendation.card.id, 20);
});

test('closed and final-column issues do not count as active resume targets', () => {
  const boardCards = createEmptyBoard();
  boardCards.Working.push(issue(1, { state: 'closed' }));
  boardCards.Merged.push(issue(2));
  boardCards.Passed.push(issue(3));

  const recommendation = getDashboardHeroRecommendation({
    boardCards,
    githubToken: 'sample-token'
  });

  assert.equal(recommendation.kind, 'find-contributions');
});

test('working issue is prioritized before normal board order', () => {
  const boardCards = createEmptyBoard();
  boardCards.Considering.push(issue(1));
  boardCards.Working.push(issue(2));

  const recommendation = getDashboardHeroRecommendation({
    boardCards,
    githubToken: 'sample-token'
  });

  assert.equal(recommendation.kind, 'resume');
  assert.equal(recommendation.card.id, 2);
  assert.equal(recommendation.column, 'Working');
});

test('dashboard hero does not recommend hidden saved issues', () => {
  const boardCards = createEmptyBoard();
  boardCards.Working.push(issue(1));

  const recommendation = getDashboardHeroRecommendation({
    boardCards,
    githubToken: 'sample-token',
    hiddenFilter: () => []
  });

  assert.equal(recommendation.kind, 'find-contributions');
});

test('dashboard saved preview filters hidden saved issues without deleting board cards', () => {
  const boardCards = createEmptyBoard();
  boardCards.Considering.push(issue(1, { repository: { full_name: 'owner/repo' } }));
  boardCards.Working.push(issue(2, { repository: { full_name: 'owner/keep' } }));

  const preview = getDashboardSavedPreviewCards(boardCards, {
    hiddenFilter: cards => cards.filter(card => card.repository.full_name !== 'owner/repo')
  });

  assert.deepEqual(preview.map(card => card.id), [2]);
  assert.equal(boardCards.Considering.length, 1);
  assert.equal(boardCards.Working.length, 1);
});

test('dashboard saved preview is empty when all saved candidates are hidden', () => {
  const boardCards = createEmptyBoard();
  boardCards.Considering.push(issue(1));

  const preview = getDashboardSavedPreviewCards(boardCards, {
    hiddenFilter: () => []
  });

  assert.deepEqual(preview, []);
});

test('dashboard saved preview excludes final Passed and Merged cards', () => {
  const boardCards = createEmptyBoard();
  boardCards.Passed.push(issue(1));
  boardCards.Merged.push(issue(2));

  const preview = getDashboardSavedPreviewCards(boardCards);

  assert.deepEqual(preview, []);
});
