import type { EntityKind, EntitySummary } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { compareCandidates, comparePath, parseCompare, toCompareParams } from './compareState';

const kinds: Record<string, EntityKind> = {
  audi: 'make',
  skoda: 'make',
  seat: 'make',
  bmw: 'make',
  cupra: 'make',
  'audi-q4': 'model',
  'cg-vag': 'corporategroup',
  total: 'total',
};
const parse = (query: string) => parseCompare(new URLSearchParams(query), (id) => kinds[id]);

describe('parseCompare', () => {
  it('starts empty on the default measure and range', () => {
    expect(parse('')).toEqual({
      state: { items: [], metric: 'rolling', range: 'all' },
      dropped: 0,
    });
  });

  it('reads the items, the measure and the range', () => {
    const { state } = parse('items=audi,skoda&metric=bevShare&range=5y');
    expect(state).toEqual({ items: ['audi', 'skoda'], metric: 'bevShare', range: '5y' });
  });

  it('falls back to the defaults for values it does not know', () => {
    expect(parse('metric=nope&range=nope').state).toMatchObject({
      metric: 'rolling',
      range: 'all',
    });
  });

  it('keeps only items on the level of the first one that exists', () => {
    const { state, dropped } = parse('items=nobody,audi-q4,audi,cg-vag');
    expect(state.items).toEqual(['audi-q4']);
    expect(dropped).toBe(3);
  });

  it('drops the total, repeated items and anything beyond four', () => {
    const { state, dropped } = parse('items=total,audi,audi,skoda,seat,bmw,cupra');
    expect(state.items).toEqual(['audi', 'skoda', 'seat', 'bmw']);
    expect(dropped).toBe(3);
  });

  it('allows corporate groups, which are compared with each other', () => {
    expect(parse('items=cg-vag').state.items).toEqual(['cg-vag']);
  });
});

describe('toCompareParams', () => {
  it('leaves the defaults out and round-trips the rest', () => {
    expect(toCompareParams({ items: [], metric: 'rolling', range: 'all' }).toString()).toBe('');
    const state = { items: ['audi', 'skoda'], metric: 'share' as const, range: '2y' as const };
    expect(parse(toCompareParams(state).toString()).state).toEqual(state);
  });
});

describe('comparePath', () => {
  it('opens the page in the page language with the items chosen', () => {
    expect(comparePath('fi')).toBe('/fi/compare');
    expect(comparePath('en', ['audi'])).toBe('/en/compare?items=audi');
  });
});

describe('compareCandidates', () => {
  const entity = (id: string, kind: EntityKind): EntitySummary => ({
    id,
    label: id,
    kind,
    total: 1,
    last12: 1,
    bevLast12: 0,
  });
  const all = [
    entity('audi', 'make'),
    entity('bmw', 'make'),
    entity('q4', 'model'),
    entity('total', 'total'),
  ];

  it('offers every level before anything is chosen, but never the total', () => {
    expect(compareCandidates(all, [], null).map((e) => e.id)).toEqual(['audi', 'bmw', 'q4']);
  });

  it('offers only things on the level of the first one, not yet chosen', () => {
    expect(compareCandidates(all, ['audi'], 'make').map((e) => e.id)).toEqual(['bmw']);
  });
});
