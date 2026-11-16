// The page's colour scheme as one store wired to the DOM. The rules live in `colorScheme.ts`.
import { useSyncExternalStore } from 'react';
import {
  SCHEME_META_SELECTOR,
  SCHEME_STORAGE_KEY,
  metaContent,
  overrideFromStorage,
  parseOverride,
  renderedScheme,
  toggledOverride,
  type Scheme,
  type SchemeOverride,
} from './colorScheme';

let systemQuery: MediaQueryList | null = null;
const systemDarkQuery = (): MediaQueryList =>
  (systemQuery ??= window.matchMedia('(prefers-color-scheme: dark)'));

const schemeMeta = (): HTMLMetaElement | null =>
  document.querySelector<HTMLMetaElement>(SCHEME_META_SELECTOR);

const currentOverride = (): SchemeOverride => parseOverride(schemeMeta()?.content);

const currentScheme = (): Scheme => renderedScheme(currentOverride(), systemDarkQuery().matches);

function applyOverride(override: SchemeOverride): void {
  const meta = schemeMeta();
  if (meta) meta.content = metaContent(override);
}

function storeOverride(override: SchemeOverride): void {
  try {
    if (override) localStorage.setItem(SCHEME_STORAGE_KEY, override);
    else localStorage.removeItem(SCHEME_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the choice then lasts only
    // until the page is closed.
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * Watches the OS setting, the meta tag (which the toggle changes) and other tabs. The watchers are
 * installed once and stay for as long as anything subscribes.
 */
function watchScheme(): () => void {
  const media = systemDarkQuery();
  media.addEventListener('change', notify);
  const observer = new MutationObserver(notify);
  const meta = schemeMeta();
  if (meta) observer.observe(meta, { attributes: true, attributeFilter: ['content'] });
  const onStorage = (event: StorageEvent) => {
    const override = overrideFromStorage(event.key, event.newValue);
    if (override !== undefined) applyOverride(override);
  };
  window.addEventListener('storage', onStorage);
  return () => {
    media.removeEventListener('change', notify);
    observer.disconnect();
    window.removeEventListener('storage', onStorage);
  };
}

let unwatch: (() => void) | null = null;

function subscribeScheme(listener: () => void): () => void {
  listeners.add(listener);
  unwatch ??= watchScheme();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unwatch?.();
      unwatch = null;
    }
  };
}

function toggleScheme(): void {
  const next = toggledOverride(currentOverride(), systemDarkQuery().matches);
  applyOverride(next);
  storeOverride(next);
}

/** The scheme on screen, and the toggle that flips it. */
export function useColorScheme(): { scheme: Scheme; toggle: () => void } {
  const scheme = useSyncExternalStore(subscribeScheme, currentScheme);
  return { scheme, toggle: toggleScheme };
}
