import { CLOSED, comboboxReducer, type ComboboxEvent, type ComboboxState } from './combobox';

/**
 * A field that picks one value: its suggestion list and the text typed over the value `over`.
 * Without a draft for the current value the field shows the value's own name.
 */
export interface PickerState<V> {
  list: ComboboxState;
  draft: { over: V; text: string } | null;
}

export type PickerEvent<V> =
  | ComboboxEvent
  /** A text edit opens the list. */
  | { type: 'edit'; over: V; text: string }
  /** Shows the chosen name until the parent passes the chosen value, which may come later. */
  | { type: 'choose'; over: V; name: string }
  /** Blur drops text that was not chosen. */
  | { type: 'leave' };

export const PICKER_IDLE: PickerState<never> = { list: CLOSED, draft: null };

export function pickerReducer<V>(state: PickerState<V>, event: PickerEvent<V>): PickerState<V> {
  switch (event.type) {
    case 'edit':
      return {
        list: comboboxReducer(state.list, { type: 'open' }),
        draft: { over: event.over, text: event.text },
      };
    case 'choose':
      return { list: CLOSED, draft: { over: event.over, text: event.name } };
    case 'leave':
      return PICKER_IDLE;
    default:
      return { ...state, list: comboboxReducer(state.list, event) };
  }
}

export const shownText = <V>(state: PickerState<V>, value: V, name: string): string =>
  state.draft !== null && state.draft.over === value ? state.draft.text : name;
