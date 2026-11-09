import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadSiteConfig, type SiteConfig } from './siteConfig';

interface Value {
  config: SiteConfig;
  /** False until the file has been read, so pages do not flash text that is about to change. */
  ready: boolean;
}

const SiteConfigContext = createContext<Value>({ config: {}, ready: false });

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<Value>({ config: {}, ready: false });

  useEffect(() => {
    let cancelled = false;
    void loadSiteConfig().then((config) => !cancelled && setValue({ config, ready: true }));
    return () => {
      cancelled = true;
    };
  }, []);

  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export const useSiteConfig = (): Value => useContext(SiteConfigContext);
