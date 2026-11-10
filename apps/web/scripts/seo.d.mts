export const LANGS: readonly string[];
export const DEFAULT_LANG: string;
export const PAGES: readonly string[];
export function normalizeBase(address: string): string;
export function sitemapEntityIds(
  entities: { id: string; kind: string; last12: number }[],
): string[];
export function emptySitemap(): string;
export function pagePaths(entityIds?: string[]): string[];
export function buildSitemap(base: string, paths: readonly string[]): string;
export function buildRobots(base: string | null): string;
