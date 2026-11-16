import { describe, expect, it } from 'vitest';
import {
  hasMore,
  initTableView,
  isStale,
  tableViewReducer,
  type TableViewState,
} from './tableView';

const rows = ['a'];
const byCount = [{ id: 'count', desc: true }];
const byShare = [{ id: 'share', desc: true }];
const paged = (): TableViewState => initTableView({ rows, defaultSort: byCount, pageSize: 25 });
const more = (state: TableViewState) => tableViewReducer(state, { type: 'showMore' });

describe('table view', () => {
  it('starts with no search, the default order and one page', () => {
    expect(paged()).toMatchObject({ query: '', sorting: byCount, paging: { shown: 25 } });
  });

  it('adds a page at a time and tells when more rows match', () => {
    const state = more(paged());
    expect(state.paging?.shown).toBe(50);
    expect(hasMore(state, 50)).toBe(false);
    expect(hasMore(state, 51)).toBe(true);
  });

  it('starts a new search from the first page', () => {
    const state = tableViewReducer(more(paged()), { type: 'search', query: 'tesla' });
    expect(state).toMatchObject({ query: 'tesla', paging: { shown: 25 } });
  });

  it('applies a search updater and clears the search on undefined', () => {
    const typed = tableViewReducer(paged(), { type: 'search', query: 'tes' });
    const updated = tableViewReducer(typed, { type: 'search', query: (old) => `${old}la` });
    expect(updated.query).toBe('tesla');
    expect(tableViewReducer(updated, { type: 'search', query: undefined }).query).toBe('');
  });

  it('keeps the page when the order changes', () => {
    const state = tableViewReducer(more(paged()), { type: 'sort', sorting: byShare });
    expect(state).toMatchObject({ sorting: byShare, paging: { shown: 50 } });
  });

  it('applies an updater to the current order', () => {
    const state = tableViewReducer(paged(), {
      type: 'sort',
      sorting: (old) => old.map((s) => ({ ...s, desc: !s.desc })),
    });
    expect(state.sorting).toEqual([{ id: 'count', desc: false }]);
  });

  it('starts other rows from the first page and keeps the search and the order', () => {
    const before = tableViewReducer(more(paged()), { type: 'search', query: 'x' });
    const sorted = tableViewReducer(before, { type: 'sort', sorting: byShare });
    const next = ['b'];
    const state = tableViewReducer(more(sorted), {
      type: 'sync',
      rows: next,
      defaultSort: byCount,
    });
    expect(state).toMatchObject({
      rows: next,
      query: 'x',
      sorting: byShare,
      paging: { shown: 25 },
    });
  });

  it('takes another default order in place of the reader’s order and keeps the page', () => {
    const sorted = more(
      tableViewReducer(paged(), { type: 'sort', sorting: [{ id: 'name', desc: false }] }),
    );
    const state = tableViewReducer(sorted, { type: 'sync', rows, defaultSort: byShare });
    expect(state).toMatchObject({ sorting: byShare, paging: { shown: 50 } });
  });

  it('compares the default order by value, so a new array with the same order changes nothing', () => {
    const state = paged();
    expect(isStale(state, rows, [{ id: 'count', desc: true }])).toBe(false);
    expect(tableViewReducer(state, { type: 'sync', rows, defaultSort: [...byCount] })).toBe(state);
  });

  it('sees another default order as stale and the same array as current', () => {
    const state = paged();
    expect(isStale(state, rows, byCount)).toBe(false);
    expect(isStale(state, rows, byShare)).toBe(true);
  });

  it('shows every row of an unpaged table', () => {
    const state = initTableView({ rows, defaultSort: byCount, pageSize: null });
    expect(more(state)).toBe(state);
    expect(hasMore(state, 1000)).toBe(false);
    expect(
      tableViewReducer(state, { type: 'sync', rows: ['b'], defaultSort: byCount }).paging,
    ).toBe(null);
  });
});
