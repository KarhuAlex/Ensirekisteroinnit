import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEME_META_SELECTOR, SCHEME_STORAGE_KEY } from '../src/lib/colorScheme';

/**
 * The inline script in index.html applies a stored override before the first paint. It runs
 * outside the bundle, so it cannot import the constants it shares with `colorSchemeStore.ts`.
 */
describe('the theme script in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));

  it('declares both schemes, so the page follows the OS by default', () => {
    expect(head).toContain('<meta name="color-scheme" content="light dark" />');
  });

  it('reads the storage key and writes the meta that the app uses', () => {
    expect(head).toContain(`localStorage.getItem('${SCHEME_STORAGE_KEY}')`);
    expect(head).toContain(`document.querySelector('${SCHEME_META_SELECTOR}')`);
  });

  it('runs right after the meta, before any stylesheet or module', () => {
    const meta = head.indexOf('name="color-scheme"');
    const script = head.indexOf('<script>');
    expect(meta).toBeGreaterThan(-1);
    expect(script).toBeGreaterThan(meta);
    expect(head.indexOf('<link rel="stylesheet"')).toBe(-1);
    expect(head.indexOf('type="module"')).toBe(-1);
  });
});
