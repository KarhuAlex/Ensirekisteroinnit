import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { once, useRemote } from './remote';
import { loadSiteConfig, type SiteConfig } from './siteConfig';

interface Value {
  config: SiteConfig;
  /** False until the file has been read, so pages do not flash text that is about to change. */
  ready: boolean;
}

const NOT_READ: Value = { config: {}, ready: false };
const SiteConfigContext = createContext<Value>(NOT_READ);

// Never fails: a missing or broken file reads as an empty config.
const loadSiteConfigOnce = once(loadSiteConfig);

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const remote = useRemote(loadSiteConfigOnce);
  const value = useMemo<Value>(
    () => (remote.status === 'ready' ? { config: remote.data, ready: true } : NOT_READ),
    [remote],
  );
  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export const useSiteConfig = (): Value => useContext(SiteConfigContext);
