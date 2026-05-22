import { store } from '../state/store.js';
import { isGitHubApiUrl } from '../security.js';
import { buildExactIssueApiUrl } from '../lookup.js';
import { extractRepoFullName, filterIssuesByStars, hydrateIssueRepositories } from './repoMetadata.js';

// Simple in-memory cache
let recentSearchCache = null;

/**
 * Build standard GitHub search query q parameter
 */
export function buildQueryString(queryText, filters, options = {}) {
  const mode = options.mode || filters?.mode || 'find';
  const useLookupFilters = mode !== 'lookup' || Boolean(filters?.useFiltersInLookup);
  let parts = ['is:issue'];

  if (mode === 'find') {
    if (!filters.includeClosed) {
      parts.push('state:open');
    }
    parts.push('archived:false');
  } else if (useLookupFilters && !filters.includeClosed) {
    parts.push('state:open');
  }

  if (queryText && queryText.trim().length > 0) {
    parts.push(queryText.trim());
  }

  if (mode === 'lookup' && !useLookupFilters) {
    return parts.join(' ');
  }

  // Languages filter
  if (filters.languages && filters.languages.length > 0) {
    // If multiple languages are selected, we search for them
    // E.g. (language:TypeScript OR language:Rust)
    const langQueries = filters.languages.map(lang => `language:${lang}`);
    if (langQueries.length === 1) {
      parts.push(langQueries[0]);
    } else {
      parts.push(`(${langQueries.join(' OR ')})`);
    }
  }

  // Labels filter
  if (filters.labels && filters.labels.length > 0) {
    const labelQueries = filters.labels.map(label => `"${String(label).replace(/"/g, '\\"')}"`);
    if (labelQueries.length === 1 || filters.labelMode === 'AND') {
      parts.push(...labelQueries.map(label => `label:${label}`));
    } else {
      parts.push(`label:${labelQueries.join(',')}`);
    }
  }

  // Comments filter
  if (filters.comments && filters.comments !== 'Any') {
    if (filters.comments === 'Low (0-5)') parts.push('comments:0..5');
    else if (filters.comments === 'Medium (6-15)') parts.push('comments:6..15');
    else if (filters.comments === 'High (15+)') parts.push('comments:>15');
  }

  // Updated Date filter
  if (filters.updatedDate && filters.updatedDate !== 'Any') {
    const now = new Date();
    if (filters.updatedDate === 'Last 24h') {
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      parts.push(`updated:>=${past.toISOString().split('T')[0]}`);
    } else if (filters.updatedDate === 'Last week') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      parts.push(`updated:>=${past.toISOString().split('T')[0]}`);
    } else if (filters.updatedDate === 'Last month') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      parts.push(`updated:>=${past.toISOString().split('T')[0]}`);
    }
  }

  if (filters.unassigned) {
    parts.push('no:assignee');
  }

  return parts.join(' ');
}

export function buildQueryPreview(queryText, filters, options = {}) {
  return buildQueryString(queryText, filters, options);
}

export function buildSearchIssuesUrl(queryText, filters, options = {}) {
  const q = buildQueryString(queryText, filters, options);
  let sortParam = '';
  const orderParam = 'desc';
  const mode = options.mode || filters?.mode || 'find';
  const canApplySort = mode !== 'lookup' || Boolean(filters?.useFiltersInLookup);

  if (canApplySort && filters.sortMode === 'Updated Date') {
    sortParam = 'updated';
  } else if (canApplySort && filters.sortMode === 'Most Commented') {
    sortParam = 'comments';
  } else if (canApplySort && filters.sortMode === 'Recently Created') {
    sortParam = 'created';
  }

  let url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}`;
  if (sortParam) {
    url += `&sort=${sortParam}&order=${orderParam}`;
  }
  return url;
}

function repositoryFromApiUrl(repositoryUrl) {
  try {
    const url = new URL(repositoryUrl || '');
    const segments = url.pathname.split('/').filter(Boolean);
    if (url.protocol === 'https:' && url.hostname === 'api.github.com' && segments.length === 3 && segments[0] === 'repos') {
      return {
        owner: { login: segments[1] },
        name: segments[2],
        full_name: `${segments[1]}/${segments[2]}`,
        url: repositoryUrl
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeGitHubIssue(issue) {
  const repository = issue.repository?.full_name
    ? issue.repository
    : repositoryFromApiUrl(issue.repository_url);

  return {
    ...issue,
    repository: repository || issue.repository || { name: 'github', full_name: 'github' }
  };
}

export function createGitHubHeaders(url, token = '') {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const trimmedToken = String(token || '').trim();
  if (trimmedToken && isGitHubApiUrl(url)) {
    headers.Authorization = `Bearer ${trimmedToken}`;
  }

  return headers;
}

export function createGitHubRequestOptions(url, token = '', init = {}) {
  if (!isGitHubApiUrl(url)) {
    throw new Error('GitHub API request blocked: only https://api.github.com requests are allowed.');
  }

  const method = String(init.method || 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    throw new Error('GitHub API request blocked: v0.1 is read-only.');
  }

  return {
    ...init,
    method,
    headers: {
      ...createGitHubHeaders(url, token),
      ...(init.headers || {})
    }
  };
}

export class GitHubRefreshRateLimitError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'GitHubRefreshRateLimitError';
    this.isRateLimit = true;
    this.status = details.status ?? null;
    this.rateLimit = details.rateLimit || { remaining: null, limit: null, reset: null };
    this.retryAfter = details.retryAfter ?? null;
  }
}

function getIssueApiUrl(issue) {
  const number = Number.parseInt(issue?.number, 10);
  const fullName = issue?.repository?.full_name;
  if (fullName && Number.isFinite(number) && number > 0) {
    const [owner, repo] = fullName.split('/');
    if (owner && repo) {
      return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}`;
    }
  }

  try {
    const url = new URL(issue?.html_url || '');
    const segments = url.pathname.split('/').filter(Boolean);
    if (url.protocol === 'https:' && url.hostname === 'github.com' && segments.length >= 4 && segments[2] === 'issues') {
      return `https://api.github.com/repos/${encodeURIComponent(segments[0])}/${encodeURIComponent(segments[1])}/issues/${encodeURIComponent(segments[3])}`;
    }
  } catch {
    return null;
  }

  return null;
}

function retryAfterFromResponse(response) {
  const retryAfter = response.headers.get('retry-after');
  const number = retryAfter ? parseInt(retryAfter, 10) : null;
  return Number.isFinite(number) ? number : null;
}

function isRefreshRateLimitResponse(response, errorData, rateLimit) {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;

  const message = String(errorData?.message || '').toLowerCase();
  return rateLimit.remaining === 0
    || Boolean(response.headers.get('retry-after'))
    || message.includes('rate limit')
    || message.includes('abuse detection');
}

export async function fetchIssueMetadataForRefresh(issue, options = {}) {
  const url = getIssueApiUrl(issue);
  if (!url) {
    throw new Error('Cannot refresh issue metadata because the saved card does not have a valid GitHub issue URL.');
  }

  const etag = options.etag || issue?.github_activity?.etag || '';
  const headers = etag ? { 'If-None-Match': etag } : {};
  const token = options.token ?? store.githubToken;
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(url, createGitHubRequestOptions(url, token, { headers }));

  const rateLimit = rateLimitFromResponse(response);
  store.setRateLimit(rateLimit);
  const responseEtag = response.headers.get('etag') || etag || '';

  if (response.status === 304) {
    return {
      notModified: true,
      issue: null,
      etag: responseEtag,
      rateLimit,
      retryAfter: retryAfterFromResponse(response)
    };
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (isRefreshRateLimitResponse(response, errorData, rateLimit)) {
      throw new GitHubRefreshRateLimitError(errorData.message || 'GitHub API rate limit reached.', {
        status: response.status,
        rateLimit,
        retryAfter: retryAfterFromResponse(response)
      });
    }
    throw new Error(errorData.message || `GitHub issue refresh failed with status code ${response.status}`);
  }

  return {
    notModified: false,
    issue: normalizeGitHubIssue(await response.json()),
    etag: responseEtag,
    rateLimit,
    retryAfter: retryAfterFromResponse(response)
  };
}

export async function fetchIssueMetadata(issue) {
  const result = await fetchIssueMetadataForRefresh(issue);
  return result.notModified ? normalizeGitHubIssue(issue) : result.issue;
}

function rateLimitFromResponse(response) {
  const remaining = response.headers.get('x-ratelimit-remaining');
  const limit = response.headers.get('x-ratelimit-limit');
  const reset = response.headers.get('x-ratelimit-reset');
  return {
    remaining: remaining ? parseInt(remaining, 10) : null,
    limit: limit ? parseInt(limit, 10) : null,
    reset: reset ? parseInt(reset, 10) : null
  };
}

function getLookupRepoContextFromIssue(issue) {
  return extractRepoFullName(issue) || issue?.repository?.full_name || '';
}

export async function fetchExactIssue(reference, options = {}) {
  const url = buildExactIssueApiUrl(reference);
  const mode = 'lookup';
  store.setSearchState(true, null);

  try {
    const response = await fetch(url, createGitHubRequestOptions(url, options.token ?? store.githubToken));
    const rateLimitInfo = rateLimitFromResponse(response);
    store.setRateLimit(rateLimitInfo);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub exact issue lookup failed with status code ${response.status}`);
    }

    const issue = normalizeGitHubIssue(await response.json());
    const hydrated = await hydrateIssueRepositories([issue], {
      token: options.token ?? store.githubToken,
      forceRefresh: Boolean(options.forceRepoRefresh)
    });
    const queryPreview = `GET ${buildExactIssueApiUrl(reference)}`;
    store.setLastSearchMetadata({
      mode,
      queryPreview,
      lookupRepoContext: getLookupRepoContextFromIssue(hydrated[0])
    });
    store.setSearchState(false, null, hydrated);
    return hydrated[0];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub exact issue lookup failed.';
    store.setSearchState(false, message, null);
    throw error;
  }
}

/**
 * Query GitHub REST API
 */
export async function searchGitHubIssues(queryText, forceRefresh = false, options = {}) {
  const filters = options.filters || store.filters;
  const mode = options.mode || store.finderMode || 'find';
  const q = buildQueryString(queryText, filters, { mode });
  
  // Resolve sort fields
  let sortParam = '';
  let orderParam = 'desc';
  const canApplySort = mode !== 'lookup' || Boolean(filters?.useFiltersInLookup);

  if (canApplySort && filters.sortMode === 'Updated Date') {
    sortParam = 'updated';
  } else if (canApplySort && filters.sortMode === 'Most Commented') {
    sortParam = 'comments';
  } else if (canApplySort && filters.sortMode === 'Recently Created') {
    sortParam = 'created';
  }

  // Check in-memory cache
  const cacheKey = `${mode}::${q}::${sortParam}::${orderParam}`;
  if (!forceRefresh && recentSearchCache && recentSearchCache.key === cacheKey) {
    // Update store with cached rate limits
    if (recentSearchCache.rateLimit) {
      store.setRateLimit(recentSearchCache.rateLimit);
    }
    store.setLastSearchMetadata({
      mode,
      queryPreview: q,
      lookupRepoContext: recentSearchCache.results.map(getLookupRepoContextFromIssue).find(Boolean) || store.lookupRepoContext
    });
    store.setSearchState(false, null, recentSearchCache.results);
    return recentSearchCache.results;
  }

  store.setSearchState(true, null);

  const token = store.githubToken;
  const url = buildSearchIssuesUrl(queryText, filters, { mode });

  try {
    const response = await fetch(url, createGitHubRequestOptions(url, token));

    // Parse rate limits from headers
    const rateLimitInfo = rateLimitFromResponse(response);
    store.setRateLimit(rateLimitInfo);

    if (!response.ok) {
      // Handle rate limits and forbidden status
      if (response.status === 403 || response.status === 429) {
        let errorMsg = "GitHub API Rate Limit exceeded. ";
        if (!token) {
          errorMsg += "Authenticate with a GitHub Personal Access Token in Settings to receive higher rate limits.";
        } else {
          errorMsg += "Your token rate limits are temporarily fully exhausted. Please try again later.";
        }
        throw new Error(errorMsg);
      } else if (response.status === 401) {
        throw new Error("Invalid GitHub Personal Access Token. Please check your credentials in the Settings screen.");
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `GitHub API request failed with status code ${response.status}`);
      }
    }

    const data = await response.json();
    
    // Filter out pull requests just in case (is:issue usually takes care of it, but good to be safe)
    const items = (data.items || []).filter(item => !item.pull_request).map(normalizeGitHubIssue);
    const hydratedItems = await hydrateIssueRepositories(items, {
      token,
      forceRefresh: Boolean(options.forceRepoRefresh)
    });
    const locallyFilteredItems = (mode === 'find' || filters.useFiltersInLookup)
      ? filterIssuesByStars(hydratedItems, filters.stars)
      : hydratedItems;

    // Save in-memory cache
    recentSearchCache = {
      key: cacheKey,
      results: locallyFilteredItems,
      rateLimit: rateLimitInfo
    };

    const firstRepo = locallyFilteredItems.map(getLookupRepoContextFromIssue).find(Boolean) || store.lookupRepoContext;
    store.setLastSearchMetadata({
      mode,
      queryPreview: q,
      lookupRepoContext: firstRepo
    });
    store.setSearchState(false, null, locallyFilteredItems);
    return locallyFilteredItems;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub API request failed.';
    store.setSearchState(false, message, null);
    throw error;
  }
}
