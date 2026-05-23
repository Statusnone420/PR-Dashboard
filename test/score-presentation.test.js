import test from 'node:test';
import assert from 'node:assert/strict';

test('match strength labels avoid false percentage precision', async () => {
  const { getMatchStrength } = await import('../src/scorePresentation.js');

  assert.deepEqual(getMatchStrength(95), { label: 'Strong match', tone: 'strong' });
  assert.deepEqual(getMatchStrength(80), { label: 'Good match', tone: 'good' });
  assert.deepEqual(getMatchStrength(60), { label: 'Possible match', tone: 'possible' });
  assert.deepEqual(getMatchStrength(30), { label: 'Skip', tone: 'skip' });
});
