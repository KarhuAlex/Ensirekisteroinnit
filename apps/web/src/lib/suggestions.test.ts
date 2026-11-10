import type { EntitySummary } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { rankSuggestions, searchTokens } from './suggestions';

const entity = (id: string, label: string, last12: number, total = last12): EntitySummary =>
  ({ id, label, kind: 'model', last12, total }) as EntitySummary;

const catalog = [
  entity('a4', 'Audi A4', 100),
  entity('a6', 'Audi A6', 300),
  entity('golf', 'Volkswagen Golf', 200),
  entity('old', 'Audi 80', 0, 50),
  entity('older', 'Audi 100', 0, 20),
];

describe('searchTokens', () => {
  it('splits on whitespace, lowercases and drops empty parts', () => {
    expect(searchTokens('  Audi   A4 ')).toEqual(['audi', 'a4']);
    expect(searchTokens('   ')).toEqual([]);
  });
});

describe('rankSuggestions', () => {
  it('keeps names that contain every token, in any order', () => {
    const ids = rankSuggestions(catalog, ['a4', 'audi'], 10).map((e) => e.id);
    expect(ids).toEqual(['a4']);
  });

  it('puts the most registered first and breaks ties by the total', () => {
    const ids = rankSuggestions(catalog, ['audi'], 10).map((e) => e.id);
    expect(ids).toEqual(['a6', 'a4', 'old', 'older']);
  });

  it('offers the most registered when nothing is typed, up to the limit', () => {
    const ids = rankSuggestions(catalog, [], 2).map((e) => e.id);
    expect(ids).toEqual(['a6', 'golf']);
  });

  it('returns nothing when no name matches, and leaves the input alone', () => {
    const before = catalog.map((e) => e.id);
    expect(rankSuggestions(catalog, ['xyz'], 5)).toEqual([]);
    expect(catalog.map((e) => e.id)).toEqual(before);
  });
});
