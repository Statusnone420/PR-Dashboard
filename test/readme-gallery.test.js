import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const readmePath = resolve(root, 'README.md');
const readme = readFileSync(readmePath, 'utf8');

const expectedImages = [
  'qa_screenshots/readme/hero-find-contributions-1920x1080.png',
  'qa_screenshots/readme/board-workflow-1920x1080.png',
  'qa_screenshots/readme/profile-proof-log-1920x1080.png',
  'qa_screenshots/readme/api-limits-popover-1920x1080.png'
];

test('README uses the curated product gallery screenshots', () => {
  assert.match(readme, /## Product Tour/);

  for (const imagePath of expectedImages) {
    assert.match(readme, new RegExp(imagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(existsSync(resolve(root, imagePath)), true, `${imagePath} should exist`);
  }

  assert.doesNotMatch(readme, /qa_screenshots\/finder-v2\/find-contributions-results-1920x1080\.png/);
});

test('README gallery copy stays grounded in real local-first workflow data', () => {
  assert.match(readme, /TEAMMATES\/teammates#13997/);
  assert.match(readme, /TEAMMATES\/teammates#13998/);
  assert.match(readme, /Find Contributions/);
  assert.match(readme, /Board/);
  assert.match(readme, /Proof Log/);
  assert.match(readme, /API limits/);

  assert.doesNotMatch(readme, /Obsidian/i);
  assert.doesNotMatch(readme, /lorem/i);
  assert.doesNotMatch(readme, /Seeded by/i);
  assert.doesNotMatch(readme, /fake/i);
});
