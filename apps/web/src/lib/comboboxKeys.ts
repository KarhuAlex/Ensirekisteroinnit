export type ArrowKey = 'ArrowDown' | 'ArrowUp';

export const isArrowKey = (key: string): key is ArrowKey =>
  key === 'ArrowDown' || key === 'ArrowUp';

/** The active option after an arrow key, kept within the list. */
export function activeAfterArrow(key: ArrowKey, active: number, count: number): number {
  if (key === 'ArrowDown') return Math.min(active + 1, Math.max(count - 1, 0));
  return Math.max(active - 1, 0);
}

export interface EnterState {
  open: boolean;
  active: number;
  count: number;
  /** The user edited the text, so the first option is a match for it. */
  typed: boolean;
  /** The user moved to an option with the arrow keys or the mouse. */
  moved: boolean;
}

/**
 * Whether Enter picks the active option. Without typed text the list only holds suggestions, so
 * Enter needs an option the user moved to; otherwise it is left to the form.
 */
export const canChoose = ({ open, active, count, typed, moved }: EnterState): boolean =>
  open && active < count && (moved || typed);
