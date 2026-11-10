import type { EntitySummary } from '@regs/core';

export const MAX_SUGGESTIONS = 8;

/** The words of a typed query; a suggestion has to contain every one of them. */
export const searchTokens = (query: string): string[] =>
  query.toLowerCase().split(/\s+/).filter(Boolean);

/** The most registered entities whose name contains every token; with no tokens, the most registered. */
export function rankSuggestions(
  entities: readonly EntitySummary[],
  tokens: readonly string[],
  limit: number,
): EntitySummary[] {
  return entities
    .filter((e) => tokens.every((token) => e.label.toLowerCase().includes(token)))
    .sort((a, b) => b.last12 - a.last12 || b.total - a.total)
    .slice(0, limit);
}
