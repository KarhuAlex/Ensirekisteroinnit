import { describe, expect, it } from 'vitest';
import { canonicalHref } from './canonical';

describe('canonicalHref', () => {
  it('joins the site address and the path', () => {
    expect(canonicalHref('https://example.org', '/fi/review')).toBe(
      'https://example.org/fi/review',
    );
  });

  it('drops a trailing slash', () => {
    expect(canonicalHref('https://example.org', '/fi/about/')).toBe('https://example.org/fi/about');
  });

  it('has no canonical address without a site address', () => {
    expect(canonicalHref(undefined, '/fi')).toBeNull();
  });
});
