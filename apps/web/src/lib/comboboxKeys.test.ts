import { describe, expect, it } from 'vitest';
import { activeAfterArrow, canChoose, isArrowKey } from './comboboxKeys';

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

describe('canChoose', () => {
  const base = { open: true, active: 0, count: 3, typed: false, moved: false };

  it('needs an option the user moved to while only suggestions are listed', () => {
    expect(canChoose(base)).toBe(false);
    expect(canChoose({ ...base, moved: true })).toBe(true);
  });

  it('accepts the first match once the user has typed', () => {
    expect(canChoose({ ...base, typed: true })).toBe(true);
  });

  it('never chooses from a closed list or past the last option', () => {
    expect(canChoose({ ...base, typed: true, open: false })).toBe(false);
    expect(canChoose({ ...base, typed: true, active: 3 })).toBe(false);
    expect(canChoose({ ...base, typed: true, count: 0 })).toBe(false);
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
