export const PROFILE_STORAGE_KEY = 'pr_dashboard_profile_v1';

function getStorage(storage) {
  return storage || globalThis.localStorage || null;
}

function compactProfile(profile = {}) {
  return {
    version: 1,
    login: String(profile.login || ''),
    name: String(profile.name || ''),
    github_url: String(profile.github_url || profile.html_url || ''),
    saved_at: String(profile.saved_at || new Date().toISOString())
  };
}

export function loadProfile(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return null;

  try {
    const raw = targetStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const profile = compactProfile(JSON.parse(raw));
    return profile.login || profile.name ? profile : null;
  } catch {
    targetStorage.removeItem(PROFILE_STORAGE_KEY);
    return null;
  }
}

export function saveProfile(profile, storage = getStorage()) {
  const targetStorage = getStorage(storage);
  const compact = compactProfile(profile);
  if (targetStorage) {
    targetStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(compact));
  }
  return compact;
}

export function saveProfileFromGitHubUser(user, storage = getStorage(), options = {}) {
  return saveProfile({
    login: user?.login,
    name: user?.name,
    github_url: user?.html_url,
    saved_at: options.now || new Date().toISOString()
  }, storage);
}

export function clearProfile(storage = getStorage()) {
  const targetStorage = getStorage(storage);
  if (targetStorage) targetStorage.removeItem(PROFILE_STORAGE_KEY);
}

export function getProfileInitials(profile) {
  const source = String(profile?.login || profile?.name || '').trim();
  if (!source) return 'GH';
  const letters = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('');
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? letters : source.slice(0, 2)).slice(0, 2).toUpperCase();
}
