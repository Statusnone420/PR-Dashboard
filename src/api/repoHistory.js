import { cleanReason, getCachedIssueEnrichmentEntry, getStorage, isoFromMs, nowMs, saveIssueEnrichmentEntry } from './enrichmentCache.js';
import { createReadOnlyGitHubRequestOptions, rateLimitFromReadOnlyResponse } from './githubReadOnly.js';
import { getCanonicalIssueKey, getIssueNumber, getRepoDisplayName } from '../issueKeys.js';

const REPO_HISTORY_CACHE_TYPE = 'repo-history';
const SAMPLE_SIZE = 5;
const SAME_LABEL_FETCH_SIZE = SAMPLE_SIZE + 1;

function repoParts(issue) {
  const key = getCanonicalIssueKey(issue);
  const repoDisplay = getRepoDisplayName(issue);
  if (!key || !repoDisplay) return null;
  const [owner, repo] = String(repoDisplay).split('/');
  if (!owner || !repo) return null;
  return { owner, repo, fullName: `${owner}/${repo}` };
}

function firstUsefulLabel(issue) {
  const labels = (issue?.labels || [])
    .map(label => String(typeof label === 'object' ? label.name : label || '').trim())
    .filter(Boolean);
  return labels.find(label => /good first issue|help wanted|bug|docs?|documentation/i.test(label)) || labels[0] || '';
}

function daysSince(value, now) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return (now - date.getTime()) / (24 * 60 * 60 * 1000);
}

function isCurrentIssueSample(item, issue) {
  const currentKey = getCanonicalIssueKey(issue);
  const itemKey = getCanonicalIssueKey(item);
  if (currentKey && itemKey) return currentKey === itemKey;

  const currentNumber = getIssueNumber(issue);
  const itemNumber = getIssueNumber(item);
  return Boolean(currentNumber && itemNumber && currentNumber === itemNumber);
}

function getPeerSameLabelIssueItems(sameLabelIssues, issue) {
  const items = Array.isArray(sameLabelIssues?.items) ? sameLabelIssues.items : [];
  return items
    .filter(item => !isCurrentIssueSample(item, issue))
    .slice(0, SAMPLE_SIZE);
}

function normalizeRepoHistorySummary(summary = {}) {
  const reasons = Array.isArray(summary.reasons)
    ? summary.reasons.map(cleanReason).filter(Boolean).slice(0, 8)
    : [];
  return {
    inspected: Boolean(summary.inspected),
    sampledPullRequests: Math.max(0, Number.parseInt(summary.sampledPullRequests, 10) || 0),
    mergedPullRequests: Math.max(0, Number.parseInt(summary.mergedPullRequests, 10) || 0),
    sampledSameLabelIssues: Math.max(0, Number.parseInt(summary.sampledSameLabelIssues, 10) || 0),
    recentMergedPrs: Boolean(summary.recentMergedPrs),
    activeSameLabelIssues: Boolean(summary.activeSameLabelIssues),
    staleSameLabelSample: Boolean(summary.staleSameLabelSample),
    reasons
  };
}

export function buildRecentPullRequestsApiUrl(issue) {
  const parts = repoParts(issue);
  if (!parts) {
    throw new Error('Cannot inspect repo history without a valid GitHub issue reference.');
  }
  return `https://api.github.com/repos/${encodeURIComponent(parts.owner)}/${encodeURIComponent(parts.repo)}/pulls?state=closed&sort=updated&direction=desc&per_page=${SAMPLE_SIZE}`;
}

export function buildSameLabelIssueSearchApiUrl(issue) {
  const parts = repoParts(issue);
  const label = firstUsefulLabel(issue);
  if (!parts || !label) {
    throw new Error('Cannot inspect same-label issues without a valid GitHub issue reference and label.');
  }
  const q = `repo:${parts.fullName} is:issue label:"${label}"`;
  return `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${SAME_LABEL_FETCH_SIZE}`;
}

export function summarizeRepoHistory(options = {}) {
  const now = nowMs(options);
  const pullRequests = Array.isArray(options.pullRequests) ? options.pullRequests : [];
  const labelItems = getPeerSameLabelIssueItems(options.sameLabelIssues, options.issue);
  const mergedPullRequests = pullRequests.filter(pr => pr?.merged_at).length;
  const recentMergedPrs = pullRequests.some(pr => pr?.merged_at && daysSince(pr.merged_at, now) <= 180);
  const activeSameLabelIssues = labelItems.some(item => daysSince(item?.updated_at, now) <= 180);
  const staleSameLabelSample = labelItems.length > 0 && labelItems.every(item => daysSince(item?.updated_at, now) > 365);

  const reasons = [];
  if (recentMergedPrs) reasons.push('Recent repo PRs are merging');
  if (activeSameLabelIssues) reasons.push('Same-label issues are active');
  if (staleSameLabelSample) reasons.push('Same-label issues look stale');
  if (!reasons.length) reasons.push('Repo history sample is limited');

  return normalizeRepoHistorySummary({
    inspected: true,
    sampledPullRequests: pullRequests.length,
    mergedPullRequests,
    sampledSameLabelIssues: labelItems.length,
    recentMergedPrs,
    activeSameLabelIssues,
    staleSameLabelSample,
    reasons
  });
}

export function saveRepoHistoryEnrichment(issue, summary, storage = getStorage(), options = {}) {
  return saveIssueEnrichmentEntry(issue, REPO_HISTORY_CACHE_TYPE, normalizeRepoHistorySummary(summary), storage, options);
}

export function getCachedRepoHistoryEnrichment(issue, storage = getStorage(), options = {}) {
  const entry = getCachedIssueEnrichmentEntry(issue, REPO_HISTORY_CACHE_TYPE, storage, options);
  return entry ? { ...entry, summary: normalizeRepoHistorySummary(entry.summary) } : null;
}

export async function fetchRepoHistoryEnrichment(issue, options = {}) {
  const storage = getStorage(options.storage);
  const cached = options.forceRefresh ? null : getCachedRepoHistoryEnrichment(issue, storage, options);
  if (cached) {
    return { summary: cached.summary, fromCache: true, cached: true, rateLimit: null };
  }

  const token = options.token || '';
  const fetchImpl = options.fetchImpl || fetch;
  const pullUrl = buildRecentPullRequestsApiUrl(issue);
  const pullResponse = await fetchImpl(pullUrl, createReadOnlyGitHubRequestOptions(pullUrl, token));
  const pullRateLimit = rateLimitFromReadOnlyResponse(pullResponse, 'core', { now: isoFromMs(nowMs(options)) });
  if (!pullResponse.ok) {
    const errorData = await pullResponse.json().catch(() => ({}));
    throw new Error(errorData.message || `GitHub pull request sample failed with status code ${pullResponse.status}`);
  }

  const labelUrl = buildSameLabelIssueSearchApiUrl(issue);
  const labelResponse = await fetchImpl(labelUrl, createReadOnlyGitHubRequestOptions(labelUrl, token));
  const labelRateLimit = rateLimitFromReadOnlyResponse(labelResponse, 'search', { now: isoFromMs(nowMs(options)) });
  if (!labelResponse.ok) {
    const errorData = await labelResponse.json().catch(() => ({}));
    throw new Error(errorData.message || `GitHub same-label issue sample failed with status code ${labelResponse.status}`);
  }

  const summary = summarizeRepoHistory({
    pullRequests: await pullResponse.json(),
    sameLabelIssues: await labelResponse.json(),
    issue,
    now: nowMs(options)
  });
  const cachedEntry = saveRepoHistoryEnrichment(issue, summary, storage, {
    now: nowMs(options),
    tokenUsed: Boolean(String(token).trim())
  });

  return {
    summary,
    fromCache: false,
    cached: Boolean(cachedEntry),
    rateLimit: labelRateLimit || pullRateLimit
  };
}
