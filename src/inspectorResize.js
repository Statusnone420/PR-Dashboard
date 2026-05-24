export const INSPECTOR_WIDTH_STORAGE_KEY = 'pr_dashboard_inspector_width_v1';

const MIN_INSPECTOR_WIDTH = 420;
const RESERVED_PAGE_WIDTH = 360;
const RESIZE_DISABLED_BELOW = MIN_INSPECTOR_WIDTH + RESERVED_PAGE_WIDTH;

function getViewportWidth(viewport) {
  if (typeof viewport === 'number') return viewport;
  if (viewport && typeof viewport.width === 'number') return viewport.width;
  return 0;
}

function getStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

function readStoredWidths(storage) {
  const source = getStorage(storage);
  if (!source) return {};

  try {
    const parsed = JSON.parse(source.getItem(INSPECTOR_WIDTH_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function isResizableViewport(viewport) {
  return getViewportWidth(viewport) >= RESIZE_DISABLED_BELOW;
}

export function bucketForViewport(viewport) {
  const width = getViewportWidth(viewport);
  if (width >= 1536) return '2xl';
  if (width >= 1280) return 'xl';
  return 'lg';
}

export function clampWidth(rawWidth, viewport) {
  const width = getViewportWidth(viewport);
  const value = Number(rawWidth);
  if (!Number.isFinite(value) || !isResizableViewport(width)) return null;

  const maxWidth = Math.min(width * 0.8, width - RESERVED_PAGE_WIDTH);
  if (maxWidth < MIN_INSPECTOR_WIDTH) return null;
  return Math.round(Math.min(Math.max(value, MIN_INSPECTOR_WIDTH), maxWidth));
}

export function loadInspectorWidth(viewport, storage = null) {
  const stored = readStoredWidths(storage);
  const value = stored[bucketForViewport(viewport)];
  return clampWidth(value, viewport);
}

export function saveInspectorWidth(width, viewport, storage = null) {
  const source = getStorage(storage);
  const clamped = clampWidth(width, viewport);
  if (!source || clamped === null) return null;

  const stored = readStoredWidths(source);
  stored[bucketForViewport(viewport)] = clamped;
  source.setItem(INSPECTOR_WIDTH_STORAGE_KEY, JSON.stringify(stored));
  return clamped;
}

export function attachResize(drawerEl, handleEl, options = {}) {
  const win = options.window || (typeof window !== 'undefined' ? window : null);
  const storage = options.storage || getStorage();
  if (!drawerEl || !handleEl || !win || !isResizableViewport(win.innerWidth)) {
    if (drawerEl) drawerEl.style.width = '';
    return () => {};
  }

  const savedWidth = loadInspectorWidth(win.innerWidth, storage);
  if (savedWidth !== null) {
    drawerEl.style.width = `${savedWidth}px`;
  } else {
    drawerEl.style.width = '';
  }

  let activePointerId = null;
  let startX = 0;
  let startWidth = 0;
  let latestWidth = null;

  function applyWidth(width) {
    const clamped = clampWidth(width, win.innerWidth);
    if (clamped === null) return;
    latestWidth = clamped;
    drawerEl.style.width = `${clamped}px`;
  }

  function onPointerMove(event) {
    if (activePointerId !== event.pointerId) return;
    applyWidth(startWidth + startX - event.clientX);
  }

  function stopResize(event) {
    if (activePointerId !== event.pointerId) return;
    if (latestWidth !== null) {
      saveInspectorWidth(latestWidth, win.innerWidth, storage);
    }
    activePointerId = null;
    handleEl.releasePointerCapture?.(event.pointerId);
    handleEl.removeEventListener('pointermove', onPointerMove);
    handleEl.removeEventListener('pointerup', stopResize);
    handleEl.removeEventListener('pointercancel', stopResize);
    win.document?.body?.classList.remove('inspector-resizing');
  }

  function onPointerDown(event) {
    if (!isResizableViewport(win.innerWidth)) return;
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startWidth = drawerEl.getBoundingClientRect().width;
    latestWidth = Math.round(startWidth);
    handleEl.setPointerCapture?.(event.pointerId);
    handleEl.addEventListener('pointermove', onPointerMove);
    handleEl.addEventListener('pointerup', stopResize);
    handleEl.addEventListener('pointercancel', stopResize);
    win.document?.body?.classList.add('inspector-resizing');
    event.preventDefault();
  }

  function onMouseMove(event) {
    if (activePointerId !== 'mouse') return;
    applyWidth(startWidth + startX - event.clientX);
  }

  function stopMouseResize() {
    if (activePointerId !== 'mouse') return;
    if (latestWidth !== null) {
      saveInspectorWidth(latestWidth, win.innerWidth, storage);
    }
    activePointerId = null;
    win.removeEventListener('mousemove', onMouseMove);
    win.removeEventListener('mouseup', stopMouseResize);
    win.document?.body?.classList.remove('inspector-resizing');
  }

  function onMouseDown(event) {
    if (!isResizableViewport(win.innerWidth)) return;
    if (activePointerId !== null) return;
    activePointerId = 'mouse';
    startX = event.clientX;
    startWidth = drawerEl.getBoundingClientRect().width;
    latestWidth = Math.round(startWidth);
    win.addEventListener('mousemove', onMouseMove);
    win.addEventListener('mouseup', stopMouseResize);
    win.document?.body?.classList.add('inspector-resizing');
    event.preventDefault();
  }

  handleEl.addEventListener('pointerdown', onPointerDown);
  handleEl.addEventListener('mousedown', onMouseDown);

  return () => {
    handleEl.removeEventListener('pointerdown', onPointerDown);
    handleEl.removeEventListener('mousedown', onMouseDown);
    handleEl.removeEventListener('pointermove', onPointerMove);
    handleEl.removeEventListener('pointerup', stopResize);
    handleEl.removeEventListener('pointercancel', stopResize);
    win.removeEventListener('mousemove', onMouseMove);
    win.removeEventListener('mouseup', stopMouseResize);
    win.document?.body?.classList.remove('inspector-resizing');
  };
}
