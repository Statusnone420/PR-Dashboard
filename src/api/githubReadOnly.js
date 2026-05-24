import { isGitHubApiUrl } from '../security.js';

export function createReadOnlyGitHubRequestOptions(url, token = '', init = {}) {
  if (!isGitHubApiUrl(url)) {
    throw new Error('GitHub enrichment request blocked: only https://api.github.com requests are allowed.');
  }
  const method = String(init.method || 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    throw new Error('GitHub enrichment request blocked: only read-only requests are allowed.');
  }
  const trimmedToken = String(token || '').trim();
  return {
    ...init,
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(trimmedToken ? { Authorization: `Bearer ${trimmedToken}` } : {}),
      ...(init.headers || {})
    }
  };
}

function parseRateLimitNumber(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

export function rateLimitFromReadOnlyResponse(response, fallbackResource = 'core', options = {}) {
  const resource = String(response.headers.get('x-ratelimit-resource') || fallbackResource).toLowerCase() === 'search'
    ? 'search'
    : 'core';
  return {
    resource,
    remaining: parseRateLimitNumber(response.headers.get('x-ratelimit-remaining')),
    limit: parseRateLimitNumber(response.headers.get('x-ratelimit-limit')),
    used: parseRateLimitNumber(response.headers.get('x-ratelimit-used')),
    reset: parseRateLimitNumber(response.headers.get('x-ratelimit-reset')),
    updatedAt: options.now || new Date().toISOString()
  };
}

function getNextLinkUrl(linkHeader) {
  const links = String(linkHeader || '').split(',');
  for (const link of links) {
    const match = link.match(/<([^>]+)>\s*;\s*rel="next"/i);
    if (match) return match[1];
  }
  return null;
}

export async function fetchPaginatedReadOnlyGitHubJson(url, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const token = options.token || '';
  const fallbackResource = options.fallbackResource || 'core';
  const now = options.now || new Date().toISOString();
  const errorMessage = options.errorMessage || 'GitHub paginated request failed';
  const items = [];
  const seenUrls = new Set();
  let nextUrl = url;
  let rateLimit = null;

  while (nextUrl) {
    if (seenUrls.has(nextUrl)) {
      throw new Error('GitHub paginated request failed: repeated pagination URL.');
    }
    seenUrls.add(nextUrl);

    const response = await fetchImpl(nextUrl, createReadOnlyGitHubRequestOptions(nextUrl, token));
    rateLimit = rateLimitFromReadOnlyResponse(response, fallbackResource, { now });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `${errorMessage} with status code ${response.status}`);
    }

    const pageItems = await response.json();
    if (!Array.isArray(pageItems)) {
      throw new Error(`${errorMessage}: expected a JSON array response.`);
    }
    items.push(...pageItems);
    nextUrl = getNextLinkUrl(response.headers.get('link'));
  }

  return { items, rateLimit };
}
