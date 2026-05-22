function parseGitHubUrl(value) {
  try {
    const url = new URL(value || '');
    if (url.hostname !== 'github.com') return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 4 && (segments[2] === 'issues' || segments[2] === 'pull')) {
      const number = Number.parseInt(segments[3], 10);
      if (Number.isInteger(number) && number > 0) {
        return {
          owner: segments[0],
          repo: segments[1],
          number,
          type: segments[2] === 'pull' ? 'pull' : 'issue'
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function parseApiRepoUrl(value) {
  try {
    const url = new URL(value || '');
    if (url.hostname !== 'api.github.com') return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 3 && segments[0] === 'repos') {
      return `${segments[1]}/${segments[2]}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function getIssueNumber(issue) {
  const direct = Number.parseInt(issue?.number, 10);
  if (Number.isInteger(direct) && direct > 0) return direct;
  return parseGitHubUrl(issue?.html_url)?.number || null;
}

export function getRepoDisplayName(issue) {
  const fullName = issue?.repository?.full_name || issue?.repository?.nameWithOwner;
  if (fullName && String(fullName).includes('/')) return String(fullName);
  const fromHtml = parseGitHubUrl(issue?.html_url);
  if (fromHtml) return `${fromHtml.owner}/${fromHtml.repo}`;
  return parseApiRepoUrl(issue?.repository_url);
}

export function getCanonicalRepoKey(issue) {
  const repo = getRepoDisplayName(issue);
  return repo ? repo.toLowerCase() : null;
}

export function getCanonicalIssueKey(issue) {
  const repo = getCanonicalRepoKey(issue);
  const number = getIssueNumber(issue);
  if (!repo || !number) return null;
  return `${repo}#${number}`;
}

export function getIssueDisplayKey(issue) {
  const repo = getRepoDisplayName(issue);
  const number = getIssueNumber(issue);
  if (!repo || !number) return null;
  return `${repo}#${number}`;
}

export function getIssueType(issue) {
  if (issue?.pull_request) return 'pull';
  return parseGitHubUrl(issue?.html_url)?.type || 'issue';
}

export function getIssueUrlKind(value) {
  return parseGitHubUrl(value)?.type || null;
}
