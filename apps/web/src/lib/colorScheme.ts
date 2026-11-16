/**
 * The rules of the theme toggle, kept free of the DOM.
 *
 * The page follows the OS colour scheme unless the user has overridden it. The toggle offers two
 * states: the system default, and the opposite of the system stored as a literal value. Toggling
 * back to what the system shows removes the override instead of pinning it, so the page follows
 * later OS changes again. An override is never dropped just because the OS later comes to match it:
 * many systems switch scheme by time of day, and that would make pinning impossible.
 */

export type Scheme = 'light' | 'dark';

/** A stored override, or `null` to follow the system. */
export type SchemeOverride = Scheme | null;

/** The storage key; the inline script in index.html reads the same key before the first paint. */
export const SCHEME_STORAGE_KEY = 'theme';

/** The element that carries the override; the inline script in index.html writes the same one. */
export const SCHEME_META_SELECTOR = 'meta[name="color-scheme"]';

/**
 * The override that a `storage` event from another tab carries, or `undefined` when the event is
 * about another key. A `null` key means storage was cleared, which means following the system.
 */
export function overrideFromStorage(
  key: string | null,
  newValue: string | null,
): SchemeOverride | undefined {
  if (key !== null && key !== SCHEME_STORAGE_KEY) return undefined;
  return parseOverride(newValue);
}

/** The value of `<meta name="color-scheme">` for an override. */
export const metaContent = (override: SchemeOverride): string => override ?? 'light dark';

/** Reads a stored or meta value; anything but an explicit scheme means "follow the system". */
export function parseOverride(value: string | null | undefined): SchemeOverride {
  return value === 'light' || value === 'dark' ? value : null;
}

export const renderedScheme = (override: SchemeOverride, systemDark: boolean): Scheme =>
  override ?? (systemDark ? 'dark' : 'light');

/** The override after one press of the toggle: the opposite of what is on screen now. */
export function toggledOverride(override: SchemeOverride, systemDark: boolean): SchemeOverride {
  const target: Scheme = renderedScheme(override, systemDark) === 'dark' ? 'light' : 'dark';
  const system: Scheme = systemDark ? 'dark' : 'light';
  return target === system ? null : target;
}
