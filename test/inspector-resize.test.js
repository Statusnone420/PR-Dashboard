import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSPECTOR_WIDTH_STORAGE_KEY,
  bucketForViewport,
  attachResize,
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

function createResizeHarness({ viewport = 1024, width = '720px' } = {}) {
  const listeners = new Map();
  const layoutWidth = Number.parseFloat(width) || 0;
  const handle = {
    attributes: {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    }
  };
  const drawer = {
    style: { width },
    getBoundingClientRect() {
      return { width: Number.parseFloat(this.style.width) || layoutWidth };
    }
  };
  const classList = {
    add() {},
    remove() {}
  };
  const win = {
    innerWidth: viewport,
    document: { body: { classList } },
    addEventListener() {},
    removeEventListener() {}
  };

  return { drawer, handle, win, listeners };
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

test('attachResize clears stale inline width when current bucket has no saved width', () => {
  const storage = createStorage({
    [INSPECTOR_WIDTH_STORAGE_KEY]: JSON.stringify({ xl: 720 })
  });
  const { drawer, handle, win } = createResizeHarness({ viewport: 1024, width: '720px' });

  const detach = attachResize(drawer, handle, { window: win, storage });

  assert.equal(drawer.style.width, '');
  detach();
});

test('attachResize publishes slider value metadata for assistive tech', () => {
  const storage = createStorage({
    [INSPECTOR_WIDTH_STORAGE_KEY]: JSON.stringify({ xl: 720 })
  });
  const { drawer, handle, win } = createResizeHarness({ viewport: 1366, width: '620px' });

  const detach = attachResize(drawer, handle, { window: win, storage });

  assert.equal(drawer.style.width, '720px');
  assert.equal(handle.getAttribute('aria-valuemin'), '420');
  assert.equal(handle.getAttribute('aria-valuemax'), '1006');
  assert.equal(handle.getAttribute('aria-valuenow'), '720');
  assert.equal(handle.getAttribute('aria-valuetext'), '720 pixels wide');
  detach();
});

test('keyboard inspector resize changes width and persists bucketed value', () => {
  const storage = createStorage();
  const { drawer, handle, win, listeners } = createResizeHarness({ viewport: 1366, width: '620px' });
  const detach = attachResize(drawer, handle, { window: win, storage });
  const keydown = listeners.get('keydown');
  const eventFor = key => ({
    key,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    }
  });

  assert.equal(typeof keydown, 'function');

  const increase = eventFor('ArrowRight');
  keydown(increase);
  assert.equal(increase.defaultPrevented, true);
  assert.equal(drawer.style.width, '660px');
  assert.equal(handle.getAttribute('aria-valuenow'), '660');
  assert.equal(JSON.parse(storage.getItem(INSPECTOR_WIDTH_STORAGE_KEY)).xl, 660);

  const end = eventFor('End');
  keydown(end);
  assert.equal(drawer.style.width, '1006px');
  assert.equal(handle.getAttribute('aria-valuenow'), '1006');

  const home = eventFor('Home');
  keydown(home);
  assert.equal(drawer.style.width, '420px');
  assert.equal(handle.getAttribute('aria-valuenow'), '420');
  detach();
});
