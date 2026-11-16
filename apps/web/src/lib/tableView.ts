import type { SortingState, Updater } from '@tanstack/react-table';

/** How many rows are shown, and how many each "show more" adds. */
export interface Paging {
  size: number;
  shown: number;
}

/** The search, order and page of a table; the reducer tests list the rules between them. */
export interface TableViewState {
  query: string;
  sorting: SortingState;
  /** `null` for a table that shows every row. */
  paging: Paging | null;
  /** The rows the page was set up for, compared by identity. */
  rows: unknown;
  /** The default order the sorting was set up for. `key` compares it by value. */
  defaultSort: { order: SortingState; key: string };
}

export interface TableViewInput {
  rows: unknown;
  defaultSort: SortingState;
  pageSize: number | null;
}

export type TableViewEvent =
  /** TanStack may pass an updater, or `undefined` to clear the search. */
  | { type: 'search'; query: Updater<string | undefined> }
  | { type: 'sort'; sorting: Updater<SortingState> }
  | { type: 'showMore' }
  /** Sent on every render with the rows and default order the table has now. */
  | { type: 'sync'; rows: unknown; defaultSort: SortingState };

const defaultSortOf = (order: SortingState) => ({ order, key: JSON.stringify(order) });

const firstPage = (paging: Paging | null): Paging | null =>
  paging && { size: paging.size, shown: paging.size };

export function initTableView({ rows, defaultSort, pageSize }: TableViewInput): TableViewState {
  return {
    query: '',
    sorting: defaultSort,
    paging: pageSize === null ? null : { size: pageSize, shown: pageSize },
    rows,
    defaultSort: defaultSortOf(defaultSort),
  };
}

/** A caller that keeps passing the same array skips the comparison by value. */
const sameDefaultSort = (state: TableViewState, order: SortingState): boolean =>
  state.defaultSort.order === order || state.defaultSort.key === JSON.stringify(order);

/** Whether the rows or the default order differ from those the state was set up for. */
export const isStale = (state: TableViewState, rows: unknown, defaultSort: SortingState): boolean =>
  state.rows !== rows || !sameDefaultSort(state, defaultSort);

export function tableViewReducer(state: TableViewState, event: TableViewEvent): TableViewState {
  switch (event.type) {
    case 'search': {
      const query = typeof event.query === 'function' ? event.query(state.query) : event.query;
      return { ...state, query: query ?? '', paging: firstPage(state.paging) };
    }
    case 'sort':
      return {
        ...state,
        sorting: typeof event.sorting === 'function' ? event.sorting(state.sorting) : event.sorting,
      };
    case 'showMore':
      return state.paging === null
        ? state
        : { ...state, paging: { ...state.paging, shown: state.paging.shown + state.paging.size } };
    case 'sync': {
      if (!isStale(state, event.rows, event.defaultSort)) return state;
      const newOrder = !sameDefaultSort(state, event.defaultSort);
      return {
        ...state,
        rows: event.rows,
        paging: state.rows === event.rows ? state.paging : firstPage(state.paging),
        defaultSort: newOrder ? defaultSortOf(event.defaultSort) : state.defaultSort,
        sorting: newOrder ? event.defaultSort : state.sorting,
      };
    }
  }
}

/** Whether "show more" has rows to add, given how many rows match the search. */
export const hasMore = (state: TableViewState, matching: number): boolean =>
  state.paging !== null && matching > state.paging.shown;
