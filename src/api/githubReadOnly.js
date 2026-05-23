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
