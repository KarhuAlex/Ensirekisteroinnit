import type { EntitySummary } from '@regs/core';
import { useMemo, useReducer, useRef } from 'react';
import { useI18n } from '../i18n';
import { entityOptions } from '../lib/entityOptions';
import { PICKER_IDLE, pickerReducer, shownText } from '../lib/picker';
import { MAX_SUGGESTIONS, rankSuggestions, searchTokens } from '../lib/suggestions';
import { Icon } from './Icon';
import { ClearButton } from './suggest/ClearButton';
import { NoMatchStatus } from './suggest/NoMatchStatus';
import { SuggestionList } from './suggest/SuggestionList';
import { useComboboxBindings } from './suggest/useCombobox';

interface Props {
  entities: readonly EntitySummary[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Words of the field; the review's wording when left out. */
  label?: string;
  placeholder?: string;
}

/** A text field with suggestions for one make or model. Empty means all cars. */
export function EntityPicker({ entities, value, onChange, label, placeholder }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const names = useMemo(
    () => new Map(entityOptions(entities, (kind) => t(`kind.${kind}`)).map((o) => [o.id, o.name])),
    [entities, t],
  );
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? '') : '');
  const [picker, dispatch] = useReducer(pickerReducer<string | null>, PICKER_IDLE);
  const text = shownText(picker, value, nameOf(value));

  const tokens = useMemo(() => searchTokens(text), [text]);
  const results = useMemo(
    () => rankSuggestions(entities, tokens, MAX_SUGGESTIONS),
    [entities, tokens],
  );

  const combobox = useComboboxBindings(picker.list, dispatch, {
    count: results.length,
    // The name of the current selection is not an edit, so Enter leaves the selection alone.
    typed: tokens.length > 0 && text !== nameOf(value),
    onChoose: (index) => {
      const hit = results[index];
      if (!hit) return;
      dispatch({ type: 'choose', over: value, name: nameOf(hit.id) });
      onChange(hit.id);
    },
  });

  const edit = (next: string) => {
    dispatch({ type: 'edit', over: value, text: next });
    if (next === '') onChange(null);
  };

  return (
    <div className="field">
      <label htmlFor={combobox.inputId}>{label ?? t('review.entity')}</label>
      <div className="field-input">
        <Icon name="search" size={18} />
        <input
          {...combobox.inputProps}
          ref={inputRef}
          type="text"
          value={text}
          placeholder={placeholder ?? t('review.entityPlaceholder')}
          onChange={(e) => edit(e.target.value)}
          // Text that was not chosen is dropped, so the field always shows what is selected.
          onBlur={() => dispatch({ type: 'leave' })}
        />
        {text && (
          <ClearButton
            onClick={() => {
              edit('');
              inputRef.current?.focus();
            }}
          />
        )}
        <NoMatchStatus empty={combobox.open && tokens.length > 0 && results.length === 0} />
        {combobox.open && (
          <SuggestionList
            id={combobox.listId}
            entities={results}
            tokens={tokens}
            active={combobox.active}
            onHover={combobox.hover}
            onChoose={combobox.choose}
          />
        )}
      </div>
    </div>
  );
}
