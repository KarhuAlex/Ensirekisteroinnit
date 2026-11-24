import { describe, expect, it } from 'vitest';
import { withDefaultLang } from './langPath';

const at = (pathname: string, search = '', hash = '') =>
  withDefaultLang({ pathname, search, hash });

describe('withDefaultLang', () => {
  it('opens the front page in Finnish', () => {
    expect(at('/')).toBe('/fi');
  });

  it('keeps the page a link names when it has no language', () => {
    expect(at('/models/audi')).toBe('/fi/models/audi');
  });

  it('keeps the view in the query and the hash', () => {
    expect(at('/review', '?range=2026-10', '#top')).toBe('/fi/review?range=2026-10#top');
  });

  it('sends an unknown language to a page that does not exist, not to the front page', () => {
    expect(at('/de/models/audi')).toBe('/fi/de/models/audi');
  });
});
