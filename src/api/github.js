import { store } from '../state/store.js';
import { isGitHubApiUrl } from '../security.js';

// Simple in-memory cache
let recentSearchCache = null;

/**
 * Build standard GitHub search query q parameter
 */
export function buildQueryString(queryText, filters) {
  let parts = ['is:issue'];

  if (!filters.includeClosed) {
    parts.push('state:open');
  }

  if (queryText && queryText.trim().length > 0) {
    parts.push(queryText.trim());
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

  // Stars filter
  if (filters.stars && filters.stars !== 'Any') {
    if (filters.stars === '1k+') parts.push('stars:>=1000');
    else if (filters.stars === '5k+') parts.push('stars:>=5000');
    else if (filters.stars === '10k+') parts.push('stars:>=10000');
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

  return parts.join(' ');
}

export function buildQueryPreview(queryText, filters) {
  return buildQueryString(queryText, filters);
}

export function buildSearchIssuesUrl(queryText, filters) {
  const q = buildQueryString(queryText, filters);
  let sortParam = '';
  const orderParam = 'desc';

  if (filters.sortMode === 'Updated Date') {
    sortParam = 'updated';
  } else if (filters.sortMode === 'Most Commented') {
    sortParam = 'comments';
  } else if (filters.sortMode === 'Recently Created') {
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

export async function fetchIssueMetadata(issue) {
  const url = getIssueApiUrl(issue);
  if (!url) {
    throw new Error('Cannot refresh issue metadata because the saved card does not have a valid GitHub issue URL.');
  }

  const response = await fetch(url, createGitHubRequestOptions(url, store.githubToken));

  const remaining = response.headers.get('x-ratelimit-remaining');
  const limit = response.headers.get('x-ratelimit-limit');
  const reset = response.headers.get('x-ratelimit-reset');
  store.setRateLimit({
    remaining: remaining ? parseInt(remaining, 10) : null,
    limit: limit ? parseInt(limit, 10) : null,
    reset: reset ? parseInt(reset, 10) : null
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `GitHub issue refresh failed with status code ${response.status}`);
  }

  return response.json();
}

/**
 * Query GitHub REST API
 */
export async function searchGitHubIssues(queryText, forceRefresh = false) {
  const filters = store.filters;
  const q = buildQueryString(queryText, filters);
  
  // Resolve sort fields
  let sortParam = '';
  let orderParam = 'desc';

  if (filters.sortMode === 'Updated Date') {
    sortParam = 'updated';
  } else if (filters.sortMode === 'Most Commented') {
    sortParam = 'comments';
  } else if (filters.sortMode === 'Recently Created') {
    sortParam = 'created';
  }

  // Check in-memory cache
  const cacheKey = `${q}::${sortParam}::${orderParam}`;
  if (!forceRefresh && recentSearchCache && recentSearchCache.key === cacheKey) {
    // Update store with cached rate limits
    if (recentSearchCache.rateLimit) {
      store.setRateLimit(recentSearchCache.rateLimit);
    }
    return recentSearchCache.results;
  }

  store.setSearchState(true, null);

  const token = store.githubToken;
  const url = buildSearchIssuesUrl(queryText, filters);

  try {
    const response = await fetch(url, createGitHubRequestOptions(url, token));

    // Parse rate limits from headers
    const remaining = response.headers.get('x-ratelimit-remaining');
    const limit = response.headers.get('x-ratelimit-limit');
    const reset = response.headers.get('x-ratelimit-reset');
    const rateLimitInfo = {
      remaining: remaining ? parseInt(remaining, 10) : null,
      limit: limit ? parseInt(limit, 10) : null,
      reset: reset ? parseInt(reset, 10) : null
    };
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

    // Save in-memory cache
    recentSearchCache = {
      key: cacheKey,
      results: items,
      rateLimit: rateLimitInfo
    };

    store.setSearchState(false, null, items);
    return items;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub API request failed.';
    store.setSearchState(false, message, null);
    throw error;
  }
}
