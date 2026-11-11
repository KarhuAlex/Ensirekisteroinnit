/**
 * State of a text field with a suggestion list. A closed list has no active option, so a reopened
 * list never starts where the last use left off.
 */
export type ComboboxState =
  | { open: false }
  | {
      open: true;
      /** Index of the highlighted option. */
      active: number;
      /** The user moved to the option with the arrow keys or the mouse. */
      moved: boolean;
    };

export type ArrowKey = 'ArrowDown' | 'ArrowUp';

export type ComboboxEvent =
  /** Focus or a text edit: the list opens at its first option. */
  | { type: 'open' }
  /** An arrow key: opens a closed list at its first option, otherwise moves within the list. */
  | { type: 'arrow'; key: ArrowKey; count: number }
  | { type: 'hover'; index: number }
  /** Blur, Escape or a choice. */
  | { type: 'close' };

export const CLOSED: ComboboxState = { open: false };

export const isArrowKey = (key: string): key is ArrowKey =>
  key === 'ArrowDown' || key === 'ArrowUp';

/** The active option after an arrow key, kept within the list. */
export function activeAfterArrow(key: ArrowKey, active: number, count: number): number {
  if (key === 'ArrowDown') return Math.min(active + 1, Math.max(count - 1, 0));
  return Math.max(active - 1, 0);
}

export function comboboxReducer(state: ComboboxState, event: ComboboxEvent): ComboboxState {
  switch (event.type) {
    case 'open':
      return { open: true, active: 0, moved: false };
    case 'arrow':
      return {
        open: true,
        active: state.open ? activeAfterArrow(event.key, state.active, event.count) : 0,
        moved: true,
      };
    case 'hover':
      return state.open ? { open: true, active: event.index, moved: true } : state;
    case 'close':
      return CLOSED;
  }
}

/**
 * The option Enter picks, or null to leave Enter to the form. Without typed text the list only
 * holds suggestions, so Enter needs an option the user moved to.
 */
export function enterChoice(state: ComboboxState, count: number, typed: boolean): number | null {
  if (!state.open || state.active >= count) return null;
  return state.moved || typed ? state.active : null;
}
