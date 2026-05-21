import { calculateMatchScore } from './matchScore.js';

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?$/;
const REPO_RE = /^[A-Za-z0-9._-]+$/;

function parseRepoContext(repoContext) {
  const match = String(repoContext || '').match(/^([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]+)$/);
  if (!match) return null;
  const [, owner, repo] = match;
  if (!isValidRepoParts(owner, repo)) return null;
  return { owner, repo };
}

function isValidRepoParts(owner, repo) {
  return OWNER_RE.test(owner) && REPO_RE.test(repo) && !repo.includes('..');
}

function exactLookup(owner, repo, number, source) {
  const issueNumber = Number.parseInt(number, 10);
  if (!isValidRepoParts(owner, repo) || !Number.isInteger(issueNumber) || issueNumber <= 0) {
    return null;
  }
  return { owner, repo, number: issueNumber, source };
}

export function parseExactLookupInput(input, options = {}) {
  const value = String(input || '').trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const segments = url.pathname.split('/').filter(Boolean);
    if (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      segments.length === 4 &&
      segments[2] === 'issues'
    ) {
      return exactLookup(segments[0], segments[1], segments[3], 'url');
    }
    return null;
  } catch {
    // Not a URL; try compact forms below.
  }

  const reference = value.match(/^([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]+)#(\d+)$/);
  if (reference) {
    return exactLookup(reference[1], reference[2], reference[3], 'reference');
  }

  const bare = value.match(/^#(\d+)$/);
  if (bare) {
    const repo = parseRepoContext(options.repoContext);
    if (!repo) return null;
    return exactLookup(repo.owner, repo.repo, bare[1], 'context-number');
  }

  return null;
}

export function buildExactIssueApiUrl(reference) {
  const exact = exactLookup(reference?.owner, reference?.repo, reference?.number, reference?.source || 'reference');
  if (!exact) {
    throw new Error('Invalid GitHub issue lookup reference.');
  }
  return `https://api.github.com/repos/${encodeURIComponent(exact.owner)}/${encodeURIComponent(exact.repo)}/issues/${exact.number}`;
}

export function classifyLookupCandidate(issue, options = {}) {
  const score = calculateMatchScore(issue, options);
  const isContributionCandidate = score.isContributionCandidate;
  return {
    ...score,
    isContributionCandidate,
    warning: isContributionCandidate ? null : 'Not a contribution candidate'
  };
}
