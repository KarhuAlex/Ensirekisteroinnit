import { describe, expect, it } from 'vitest';
import {
  CLOSED,
  activeAfterArrow,
  comboboxReducer,
  enterChoice,
  isArrowKey,
  type ComboboxState,
} from './combobox';

describe('activeAfterArrow', () => {
  it('steps through the list and stops at both ends', () => {
    expect(activeAfterArrow('ArrowDown', 0, 3)).toBe(1);
    expect(activeAfterArrow('ArrowDown', 2, 3)).toBe(2);
    expect(activeAfterArrow('ArrowUp', 2, 3)).toBe(1);
    expect(activeAfterArrow('ArrowUp', 0, 3)).toBe(0);
  });

  it('stays on the first option when the list is empty', () => {
    expect(activeAfterArrow('ArrowDown', 0, 0)).toBe(0);
  });
});

describe('comboboxReducer', () => {
  const at = (active: number, moved: boolean): ComboboxState => ({ open: true, active, moved });

  it('opens at the first option, whatever was active before', () => {
    expect(comboboxReducer(CLOSED, { type: 'open' })).toEqual(at(0, false));
    expect(comboboxReducer(at(2, true), { type: 'open' })).toEqual(at(0, false));
  });

  it('moves within an open list with the arrow keys', () => {
    expect(comboboxReducer(at(0, false), { type: 'arrow', key: 'ArrowDown', count: 3 })).toEqual(
      at(1, true),
    );
    expect(comboboxReducer(at(2, true), { type: 'arrow', key: 'ArrowDown', count: 3 })).toEqual(
      at(2, true),
    );
  });

  it('opens a closed list at its first option on an arrow key', () => {
    expect(comboboxReducer(CLOSED, { type: 'arrow', key: 'ArrowDown', count: 3 })).toEqual(
      at(0, true),
    );
    expect(comboboxReducer(CLOSED, { type: 'arrow', key: 'ArrowUp', count: 3 })).toEqual(
      at(0, true),
    );
  });

  it('follows the mouse only while open', () => {
    expect(comboboxReducer(at(0, false), { type: 'hover', index: 2 })).toEqual(at(2, true));
    expect(comboboxReducer(CLOSED, { type: 'hover', index: 2 })).toBe(CLOSED);
  });

  it('forgets the active option when it closes', () => {
    expect(comboboxReducer(at(2, true), { type: 'close' })).toEqual(CLOSED);
  });
});

describe('enterChoice', () => {
  const open: ComboboxState = { open: true, active: 0, moved: false };

  it('needs an option the user moved to while only suggestions are listed', () => {
    expect(enterChoice(open, 3, false)).toBeNull();
    expect(enterChoice({ ...open, moved: true }, 3, false)).toBe(0);
  });

  it('accepts the first match once the user has typed', () => {
    expect(enterChoice(open, 3, true)).toBe(0);
  });

  it('never chooses from a closed list or past the last option', () => {
    expect(enterChoice(CLOSED, 3, true)).toBeNull();
    expect(enterChoice({ ...open, active: 3 }, 3, true)).toBeNull();
    expect(enterChoice(open, 0, true)).toBeNull();
  });
});

describe('isArrowKey', () => {
  it('recognises the two arrow keys only', () => {
    expect(isArrowKey('ArrowDown')).toBe(true);
    expect(isArrowKey('ArrowUp')).toBe(true);
    expect(isArrowKey('ArrowLeft')).toBe(false);
    expect(isArrowKey('Enter')).toBe(false);
  });
});
