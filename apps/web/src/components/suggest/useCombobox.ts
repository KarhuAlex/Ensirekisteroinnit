import { useId, useReducer, type KeyboardEvent } from 'react';
import { CLOSED, comboboxReducer, enterChoice, isArrowKey } from '../../lib/combobox';

interface Options {
  count: number;
  /** Called with the index of the suggestion the user picked, by key or by mouse. */
  onChoose: (index: number) => void;
  /** True once the user has edited the text, so the first suggestion is a match for it. */
  typed: boolean;
}

/** Wires the combobox state machine (`lib/combobox`) to a text field and its suggestion list. */
export function useCombobox({ count, typed, onChoose }: Options) {
  const listId = useId();
  const inputId = `${listId}-input`;
  const [state, dispatch] = useReducer(comboboxReducer, CLOSED);
  const openList = () => dispatch({ type: 'open' });
  const closeList = () => dispatch({ type: 'close' });
  const active = state.open ? state.active : 0;

  const choose = (index: number) => {
    closeList();
    onChoose(index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if (isArrowKey(key)) {
      event.preventDefault();
      dispatch({ type: 'arrow', key, count });
    } else if (key === 'Enter') {
      const index = enterChoice(state, count, typed);
      if (index !== null) {
        event.preventDefault();
        choose(index);
      }
    } else if (key === 'Escape') {
      closeList();
    }
  };

  const listed = state.open && count > 0;
  return {
    listId,
    inputId,
    open: state.open,
    active,
    /** Closes the list and passes the chosen suggestion on. */
    choose,
    /** The text changed: back to the first suggestion, with the list open. */
    textChanged: openList,
    hover: (index: number) => dispatch({ type: 'hover', index }),
    inputProps: {
      id: inputId,
      role: 'combobox',
      'aria-expanded': state.open,
      'aria-controls': listed ? listId : undefined,
      'aria-autocomplete': 'list' as const,
      'aria-activedescendant': listed && active < count ? `${listId}-${active}` : undefined,
      autoComplete: 'off',
      autoCapitalize: 'off',
      spellCheck: false,
      onFocus: openList,
      onBlur: closeList,
      onKeyDown,
    },
  };
}
