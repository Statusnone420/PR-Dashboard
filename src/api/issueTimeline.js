import { cleanReason, getCachedIssueEnrichmentEntry, getStorage, isoFromMs, nowMs, saveIssueEnrichmentEntry } from './enrichmentCache.js';
import { createReadOnlyGitHubRequestOptions, rateLimitFromReadOnlyResponse } from './githubReadOnly.js';
import { getCanonicalIssueKey, getIssueNumber, getRepoDisplayName } from '../issueKeys.js';

const TIMELINE_CACHE_TYPE = 'issue-timeline';

function issueKeyParts(issue) {
  const key = getCanonicalIssueKey(issue);
  const repoDisplay = getRepoDisplayName(issue);
  const number = getIssueNumber(issue);
  if (!key || !repoDisplay || !number) return null;
  const [owner, repo] = String(repoDisplay).split('/');
  if (!owner || !repo) return null;
  return { key, owner, repo, number: String(number) };
}

function hasSafeGitHubIssueUrl(issue) {
  if (!issue?.html_url) return true;
  try {
    const url = new URL(issue.html_url);
    const segments = url.pathname.split('/').filter(Boolean);
    return url.protocol === 'https:'
      && url.hostname === 'github.com'
      && segments.length >= 4
      && (segments[2] === 'issues' || segments[2] === 'pull')
      && /^\d+$/.test(segments[3]);
  } catch {
    return false;
  }
}

function normalizeTimelineSummary(summary = {}) {
  const reasons = Array.isArray(summary.reasons)
    ? summary.reasons.map(cleanReason).filter(Boolean).slice(0, 8)
    : [];
  return {
    inspected: Boolean(summary.inspected),
    totalEvents: Math.max(0, Number.parseInt(summary.totalEvents, 10) || 0),
    linkedPullRequest: Boolean(summary.linkedPullRequest),
    assignmentActivity: Boolean(summary.assignmentActivity),
    closedOrReopened: Boolean(summary.closedOrReopened),
    renamed: Boolean(summary.renamed),
    duplicateOrBlockedReference: Boolean(summary.duplicateOrBlockedReference),
    reasons
  };
}

function eventName(event) {
  return String(event?.event || '').toLowerCase();
}

function sourceIssue(event) {
  return event?.source?.issue || event?.source || {};
}

function isPullRequestReference(event) {
  const source = sourceIssue(event);
  return Boolean(source?.pull_request)
    || /\/pull\/\d+(?:$|[/?#])/i.test(String(source?.html_url || ''))
    || /\/pulls\/\d+(?:$|[/?#])/i.test(String(source?.pull_request?.url || ''));
}

export function buildIssueTimelineApiUrl(issue) {
  const parts = issueKeyParts(issue);
  if (!parts || !hasSafeGitHubIssueUrl(issue)) {
    throw new Error('Cannot inspect timeline without a valid GitHub issue reference.');
  }
  return `https://api.github.com/repos/${encodeURIComponent(parts.owner)}/${encodeURIComponent(parts.repo)}/issues/${parts.number}/timeline?per_page=100`;
}

export function summarizeIssueTimeline(events = []) {
  const list = Array.isArray(events) ? events : [];
  let linkedPullRequest = false;
  let assignmentActivity = false;
  let closedOrReopened = false;
  let renamed = false;
  let duplicateOrBlockedReference = false;

  for (const item of list) {
    const name = eventName(item);
    if (['connected', 'referenced', 'cross-referenced'].includes(name) && isPullRequestReference(item)) {
      linkedPullRequest = true;
    }
    if (name === 'assigned' || name === 'unassigned') {
      assignmentActivity = true;
    }
    if (name === 'closed' || name === 'reopened') {
      closedOrReopened = true;
    }
    if (name === 'renamed') {
      renamed = true;
    }
    if (/duplicate|blocked/i.test(String(item?.body || item?.commit_message || item?.label?.name || ''))) {
      duplicateOrBlockedReference = true;
    }
  }

  const reasons = [];
  if (linkedPullRequest) reasons.push('Timeline shows linked PR activity');
  if (assignmentActivity) reasons.push('Timeline shows assignment activity');
  if (closedOrReopened) reasons.push('Timeline includes close/reopen context');
  if (renamed) reasons.push('Issue title changed during discussion');
  if (duplicateOrBlockedReference) reasons.push('Timeline mentions duplicate or blocked context');
  if (!reasons.length) reasons.push('Timeline inspected without strong claim signals');

  return normalizeTimelineSummary({
    inspected: true,
    totalEvents: list.length,
    linkedPullRequest,
    assignmentActivity,
    closedOrReopened,
    renamed,
    duplicateOrBlockedReference,
    reasons
  });
}

export function saveIssueTimelineEnrichment(issue, summary, storage = getStorage(), options = {}) {
  return saveIssueEnrichmentEntry(issue, TIMELINE_CACHE_TYPE, normalizeTimelineSummary(summary), storage, options);
}

export function getCachedIssueTimelineEnrichment(issue, storage = getStorage(), options = {}) {
  const entry = getCachedIssueEnrichmentEntry(issue, TIMELINE_CACHE_TYPE, storage, options);
  return entry ? { ...entry, summary: normalizeTimelineSummary(entry.summary) } : null;
}

export async function fetchIssueTimelineEnrichment(issue, options = {}) {
  const storage = getStorage(options.storage);
  const cached = options.forceRefresh ? null : getCachedIssueTimelineEnrichment(issue, storage, options);
  if (cached) {
    return { summary: cached.summary, fromCache: true, cached: true, rateLimit: null };
  }

  const url = buildIssueTimelineApiUrl(issue);
  const token = options.token || '';
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(url, createReadOnlyGitHubRequestOptions(url, token));
  const rateLimit = rateLimitFromReadOnlyResponse(response, 'core', { now: isoFromMs(nowMs(options)) });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `GitHub issue timeline failed with status code ${response.status}`);
  }

  const summary = summarizeIssueTimeline(await response.json());
  const cachedEntry = saveIssueTimelineEnrichment(issue, summary, storage, {
    now: nowMs(options),
    tokenUsed: Boolean(String(token).trim())
  });

  return {
    summary,
    fromCache: false,
    cached: Boolean(cachedEntry),
    rateLimit
  };
}
