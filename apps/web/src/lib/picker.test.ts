import { describe, expect, it } from 'vitest';
import {
  PICKER_IDLE,
  pickerReducer,
  shownText,
  type PickerEvent,
  type PickerState,
} from './picker';

type State = PickerState<string | null>;
const run = (...events: PickerEvent<string | null>[]): State =>
  events.reduce<State>(pickerReducer, PICKER_IDLE);

describe('picker', () => {
  it('shows the name of the value until the user types', () => {
    expect(shownText(PICKER_IDLE, 'tesla', 'Tesla')).toBe('Tesla');
    expect(shownText(PICKER_IDLE, null, '')).toBe('');
  });

  it('opens the list and shows the typed text while typing', () => {
    const state = run({ type: 'edit', over: 'tesla', text: 'Vol' });
    expect(state.list.open).toBe(true);
    expect(shownText(state, 'tesla', 'Tesla')).toBe('Vol');
  });

  it('shows the chosen name before the parent passes the chosen value', () => {
    const state = run(
      { type: 'edit', over: 'tesla', text: 'Vol' },
      { type: 'choose', over: 'tesla', name: 'Volvo' },
    );
    expect(state.list.open).toBe(false);
    expect(shownText(state, 'tesla', 'Tesla')).toBe('Volvo');
    expect(shownText(state, 'volvo', 'Volvo')).toBe('Volvo');
  });

  it('keeps the chosen name in a field whose value stays empty', () => {
    const state = run({ type: 'choose', over: null, name: 'Volvo' });
    expect(shownText(state, null, '')).toBe('Volvo');
  });

  it('drops unchosen text and closes the list on blur', () => {
    const state = run({ type: 'edit', over: 'tesla', text: 'Vol' }, { type: 'leave' });
    expect(state).toEqual(PICKER_IDLE);
    expect(shownText(state, 'tesla', 'Tesla')).toBe('Tesla');
  });

  it('keeps the typed text when Escape only closes the list', () => {
    const state = run({ type: 'edit', over: 'tesla', text: 'Vol' }, { type: 'close' });
    expect(state.list.open).toBe(false);
    expect(shownText(state, 'tesla', 'Tesla')).toBe('Vol');
  });

  it('shows the name of a value set from outside over a draft', () => {
    const state = run({ type: 'edit', over: 'tesla', text: 'Vol' });
    expect(shownText(state, 'volvo', 'Volvo')).toBe('Volvo');
  });

  it('follows a name that changes, such as in another language', () => {
    expect(shownText(PICKER_IDLE, 'all', 'All makes')).toBe('All makes');
  });
});
