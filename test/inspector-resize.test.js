import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSPECTOR_WIDTH_STORAGE_KEY,
  bucketForViewport,
  clampWidth,
  isResizableViewport,
  loadInspectorWidth,
  saveInspectorWidth
} from '../src/inspectorResize.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test('bucketForViewport isolates laptop, wide, and ultrawide widths', () => {
  assert.equal(bucketForViewport(1024), 'lg');
  assert.equal(bucketForViewport(1279), 'lg');
  assert.equal(bucketForViewport(1280), 'xl');
  assert.equal(bucketForViewport(1535), 'xl');
  assert.equal(bucketForViewport(1536), '2xl');
  assert.equal(bucketForViewport(3440), '2xl');
});

test('clampWidth enforces usable inspector resize bounds', () => {
  assert.equal(clampWidth(300, 1366), 420);
  assert.equal(clampWidth(500, 1366), 500);
  assert.equal(clampWidth(1400, 1366), 1006);
  assert.equal(clampWidth(4000, 3440), 2752);
});

test('small viewports are not resizable', () => {
  assert.equal(isResizableViewport(779), false);
  assert.equal(isResizableViewport(780), true);
  assert.equal(clampWidth(500, 700), null);
});

test('load and save inspector width use bucketed localStorage values', () => {
  const storage = createStorage();

  saveInspectorWidth(1600, 3440, storage);
  saveInspectorWidth(700, 1366, storage);

  assert.equal(loadInspectorWidth(3440, storage), 1600);
  assert.equal(loadInspectorWidth(1366, storage), 700);
  assert.equal(loadInspectorWidth(1024, storage), null);

  const raw = JSON.parse(storage.getItem(INSPECTOR_WIDTH_STORAGE_KEY));
  assert.deepEqual(Object.keys(raw).sort(), ['2xl', 'xl']);
});

test('invalid stored inspector widths are ignored without overwriting storage', () => {
  const storage = createStorage({
    [INSPECTOR_WIDTH_STORAGE_KEY]: JSON.stringify({ lg: 'wide', xl: {}, '2xl': 1600 })
  });

  assert.equal(loadInspectorWidth(1366, storage), null);
  assert.equal(loadInspectorWidth(1440, storage), null);
  assert.equal(loadInspectorWidth(3440, storage), 1600);
  assert.equal(storage.getItem(INSPECTOR_WIDTH_STORAGE_KEY), JSON.stringify({ lg: 'wide', xl: {}, '2xl': 1600 }));
});
