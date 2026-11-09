import { describe, expect, it } from 'vitest';
import { parseSiteConfig } from './siteConfig';

describe('parseSiteConfig', () => {
  it('keeps valid values and trims text', () => {
    expect(
      parseSiteConfig({
        operator: '  Example Oy ',
        hosting: 'Some Cloud',
        contactUrl: 'https://example.org/contact',
        repoUrl: 'https://github.com/example/repo',
      }),
    ).toEqual({
      operator: 'Example Oy',
      hosting: 'Some Cloud',
      contactUrl: 'https://example.org/contact',
      repoUrl: 'https://github.com/example/repo',
    });
  });

  it('drops empty, oversized and non-string values', () => {
    expect(parseSiteConfig({ operator: '   ', hosting: 42, repoUrl: '' })).toEqual({});
    expect(parseSiteConfig({ operator: 'x'.repeat(101) })).toEqual({});
  });

  it('accepts only http and https links', () => {
    expect(parseSiteConfig({ contactUrl: 'javascript:alert(1)' })).toEqual({});
    expect(parseSiteConfig({ contactUrl: 'mailto:someone@example.org' })).toEqual({});
    expect(parseSiteConfig({ contactUrl: 'not a url' })).toEqual({});
    expect(parseSiteConfig({ repoUrl: 'http://example.org/repo' })).toEqual({
      repoUrl: 'http://example.org/repo',
    });
  });

  it('returns an empty config for anything that is not an object', () => {
    expect(parseSiteConfig(null)).toEqual({});
    expect(parseSiteConfig('text')).toEqual({});
    expect(parseSiteConfig([1, 2])).toEqual({});
  });
});
