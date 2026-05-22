const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char]);
}

export function safeInteger(value, fallback = 0) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}

export function safePercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

export function formatDate(value, fallback = 'Unknown') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString();
}

export function isGitHubApiUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' && url.hostname === 'api.github.com';
  } catch {
    return false;
  }
}

export function getSafeGitHubAvatarUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol !== 'https:' || url.hostname !== 'avatars.githubusercontent.com') return null;
    if (url.username || url.password || url.hash) return null;
    if (!url.pathname || url.pathname === '/') return null;

    for (const [key, paramValue] of url.searchParams.entries()) {
      if (!['v', 's'].includes(key) || !/^\d+$/.test(paramValue)) {
        return null;
      }
    }

    return url.href;
  } catch {
    return null;
  }
}

function isSafeGitHubIssueUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') return false;
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.length >= 4
      && (segments[2] === 'issues' || segments[2] === 'pull')
      && /^\d+$/.test(segments[3]);
  } catch {
    return false;
  }
}

function issueUrlFromApiData(issue) {
  const issueNumber = safeInteger(issue?.number, 0);
  if (issueNumber <= 0) return null;

  const apiRepoUrl = issue?.repository_url || issue?.repository?.url;
  if (!isGitHubApiUrl(apiRepoUrl)) return null;

  const url = new URL(apiRepoUrl);
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 3 || segments[0] !== 'repos') return null;

  const owner = encodeURIComponent(segments[1]);
  const repo = encodeURIComponent(segments[2]);
  return `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
}

export function getSafeIssueHtmlUrl(issue) {
  if (isSafeGitHubIssueUrl(issue?.html_url)) {
    return new URL(issue.html_url).href;
  }

  return issueUrlFromApiData(issue);
}
