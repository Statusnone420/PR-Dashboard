import { store } from '../state/store.js';
import { mockSearchIssues } from '../data/mockData.js';

// Simple in-memory cache
let recentSearchCache = null;

/**
 * Build standard GitHub search query q parameter
 */
function buildQueryString(queryText, filters) {
  let parts = ['is:issue', 'state:open'];

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
    // Treat labels as exact string queries
    filters.labels.forEach(label => {
      parts.push(`label:"${label}"`);
    });
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
    console.log("Serving search results from in-memory cache.");
    // Update store with cached rate limits
    if (recentSearchCache.rateLimit) {
      store.setRateLimit(recentSearchCache.rateLimit);
    }
    return recentSearchCache.results;
  }

  store.setSearchState(true, null);

  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const token = store.githubToken;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}`;
  if (sortParam) {
    url += `&sort=${sortParam}&order=${orderParam}`;
  }

  try {
    const response = await fetch(url, { headers });

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
    const items = (data.items || []).filter(item => !item.pull_request);

    // Save in-memory cache
    recentSearchCache = {
      key: cacheKey,
      results: items,
      rateLimit: rateLimitInfo
    };

    store.setSearchState(false, null, items);
    return items;

  } catch (error) {
    console.error("GitHub search API error:", error);
    store.setSearchState(false, error.message, null);
    
    // If API fails due to rate limits or offline, we can fall back to mockData only if there's no cached data
    if (!token && (!recentSearchCache || recentSearchCache.results.length === 0)) {
      console.warn("Using mock search results fallback due to network/API error.");
      // Seed mock results
      store.setSearchState(false, `${error.message} (Fallback Mock Data shown below)`, mockSearchIssues);
      return mockSearchIssues;
    }
    
    throw error;
  }
}
