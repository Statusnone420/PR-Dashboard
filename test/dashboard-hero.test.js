import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyBoard } from '../src/boardModel.js';
import { getDashboardHeroRecommendation } from '../src/dashboardHero.js';

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
