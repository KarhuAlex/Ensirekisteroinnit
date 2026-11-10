import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { comparePath } from '../src/lib/compareState';

const source = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');

/** The paths of the navigation entries and the routes of the router, read from their sources. */
const navPaths = [...source('components/Layout.tsx').matchAll(/path: '([^']*)', label:/g)].map(
  (m) => m[1] ?? '',
);
const routePaths = [...source('App.tsx').matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1] ?? '');

describe('navigation and routes', () => {
  it('route every navigation entry', () => {
    expect(navPaths.length).toBeGreaterThan(0);
    for (const path of navPaths.filter((p) => p !== '')) {
      expect(routePaths).toContain(path.slice(1));
    }
  });

  it('send the compare links to a routed page', () => {
    const [, lang, page] = comparePath('fi', ['audi']).split('?')[0]!.split('/');
    expect(lang).toBe('fi');
    expect(routePaths).toContain(page);
    expect(navPaths).toContain('/compare');
  });
});
