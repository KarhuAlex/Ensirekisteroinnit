import { useId, useState, type KeyboardEvent } from 'react';
import { activeAfterArrow, canChoose, isArrowKey } from '../../lib/comboboxKeys';

interface Options {
  count: number;
  /** Called with the index of the suggestion the user picked, by key or by mouse. */
  onChoose: (index: number) => void;
  /** True once the user has edited the text, so the first suggestion is a match for it. */
  typed: boolean;
}

/** Open state, the active option and the keys of a text field with a list of suggestions. */
export function useCombobox({ count, typed, onChoose }: Options) {
  const listId = useId();
  const inputId = `${listId}-input`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [moved, setMoved] = useState(false);

  /** Opens the list at its first option, so nothing is left over from the last use. */
  const reopen = () => {
    setActive(0);
    setMoved(false);
    setOpen(true);
  };

  const choose = (index: number) => {
    setOpen(false);
    onChoose(index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    if (isArrowKey(key)) {
      event.preventDefault();
      setOpen(true);
      setMoved(true);
      setActive((i) => activeAfterArrow(key, i, count));
    } else if (key === 'Enter') {
      if (canChoose({ open, active, count, typed, moved })) {
        event.preventDefault();
        choose(active);
      }
    } else if (key === 'Escape') {
      setOpen(false);
    }
  };

  const listed = open && count > 0;
  return {
    listId,
    inputId,
    open,
    active,
    /** Closes the list and passes the chosen suggestion on. */
    choose,
    /** The text changed: back to the first suggestion, with the list open. */
    textChanged: reopen,
    hover: (index: number) => {
      setActive(index);
      setMoved(true);
    },
    inputProps: {
      id: inputId,
      role: 'combobox',
      'aria-expanded': open,
      'aria-controls': listed ? listId : undefined,
      'aria-autocomplete': 'list' as const,
      'aria-activedescendant': listed && active < count ? `${listId}-${active}` : undefined,
      autoComplete: 'off',
      autoCapitalize: 'off',
      spellCheck: false,
      onFocus: reopen,
      onBlur: () => setOpen(false),
      onKeyDown,
    },
  };
}
