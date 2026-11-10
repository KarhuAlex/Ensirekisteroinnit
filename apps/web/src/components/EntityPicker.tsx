import type { EntitySummary } from '@regs/core';
import { useId, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { displayName } from '../lib/names';
import { Icon } from './Icon';

interface Props {
  entities: readonly EntitySummary[];
  value: string | null;
  onChange: (id: string | null) => void;
}

/** A text field with suggestions for one make or model. Empty means all cars. */
export function EntityPicker({ entities, value, onChange }: Props) {
  const { t } = useI18n();
  const listId = useId();
  const options = useMemo(
    () => entities.map((e) => ({ id: e.id, name: displayName(e.label) })),
    [entities],
  );
  const idByName = useMemo(() => new Map(options.map((o) => [o.name, o.id])), [options]);
  const nameOf = (id: string | null) => options.find((o) => o.id === id)?.name ?? '';
  const [text, setText] = useState(nameOf(value));
  const [shownFor, setShownFor] = useState(value);
  if (shownFor !== value) {
    setShownFor(value);
    setText(nameOf(value));
  }

  const change = (next: string) => {
    setText(next);
    if (next === '') onChange(null);
    else {
      const id = idByName.get(next);
      if (id) onChange(id);
    }
  };

  return (
    <label className="field">
      <span>{t('review.entity')}</span>
      <span className="field-input">
        <Icon name="search" size={18} />
        <input
          type="search"
          list={listId}
          value={text}
          placeholder={t('review.entityPlaceholder')}
          onChange={(e) => change(e.target.value)}
        />
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o.id} value={o.name} />
          ))}
        </datalist>
      </span>
    </label>
  );
}
