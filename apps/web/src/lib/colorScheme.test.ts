import { describe, expect, it } from 'vitest';
import {
  SCHEME_STORAGE_KEY,
  metaContent,
  overrideFromStorage,
  parseOverride,
  renderedScheme,
  toggledOverride,
} from './colorScheme';

describe('overrideFromStorage', () => {
  it('takes the new override from another tab', () => {
    expect(overrideFromStorage(SCHEME_STORAGE_KEY, 'dark')).toBe('dark');
    expect(overrideFromStorage(SCHEME_STORAGE_KEY, null)).toBeNull();
  });

  it('follows the system when storage is cleared', () => {
    expect(overrideFromStorage(null, null)).toBeNull();
  });

  it('ignores other keys', () => {
    expect(overrideFromStorage('something-else', 'dark')).toBeUndefined();
  });
});

describe('parseOverride', () => {
  it('accepts only an explicit scheme', () => {
    expect(parseOverride('dark')).toBe('dark');
    expect(parseOverride('light')).toBe('light');
    expect(parseOverride('light dark')).toBeNull();
    expect(parseOverride('auto')).toBeNull();
    expect(parseOverride(null)).toBeNull();
    expect(parseOverride(undefined)).toBeNull();
  });
});

describe('metaContent', () => {
  it('follows the system without an override', () => {
    expect(metaContent(null)).toBe('light dark');
    expect(metaContent('dark')).toBe('dark');
  });
});

describe('renderedScheme', () => {
  it('shows the override, else the system scheme', () => {
    expect(renderedScheme(null, true)).toBe('dark');
    expect(renderedScheme(null, false)).toBe('light');
    expect(renderedScheme('light', true)).toBe('light');
  });
});

describe('toggledOverride', () => {
  it('stores the opposite of the system', () => {
    expect(toggledOverride(null, false)).toBe('dark');
    expect(toggledOverride(null, true)).toBe('light');
  });

  it('returns to the system default instead of storing the system scheme', () => {
    expect(toggledOverride('dark', false)).toBeNull();
    expect(toggledOverride('light', true)).toBeNull();
  });

  it('flips what is on screen when the system has come to match the override', () => {
    // Stored dark, then the OS turned dark too: the override is kept, and the toggle shows light.
    expect(toggledOverride('dark', true)).toBe('light');
    expect(toggledOverride('light', false)).toBe('dark');
  });
});
