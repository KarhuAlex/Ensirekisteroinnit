import type { EntitySummary } from '@regs/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../data/DataProvider';
import { useI18n } from '../i18n';
import { isListed } from '../lib/entityLevel';
import { displayName } from '../lib/names';
import { MAX_SUGGESTIONS, rankSuggestions, searchTokens } from '../lib/suggestions';
import { Icon } from './Icon';
import { ClearButton } from './suggest/ClearButton';
import { SuggestionList } from './suggest/SuggestionList';
import { useCombobox } from './suggest/useCombobox';

export function usePopularModels(count: number): EntitySummary[] {
  const { entities } = useCatalog();
  return useMemo(
    () =>
      entities
        .filter((e) => e.kind === 'model' && e.last12 > 0)
        .sort((a, b) => b.last12 - a.last12)
        .slice(0, count),
    [entities, count],
  );
}

/** `hero` is the front door on the overview; `compact` sits in the top bar. */
export function SearchBox({ variant }: { variant: 'hero' | 'compact' }) {
  const { entities } = useCatalog();
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const popular = usePopularModels(MAX_SUGGESTIONS);
  const [query, setQuery] = useState('');

  const listed = useMemo(() => entities.filter((e) => isListed(e.kind)), [entities]);
  const tokens = useMemo(() => searchTokens(query), [query]);
  const results = useMemo(
    () => (tokens.length === 0 ? popular : rankSuggestions(listed, tokens, MAX_SUGGESTIONS)),
    [listed, popular, tokens],
  );

  const combobox = useCombobox({
    count: results.length,
    typed: tokens.length > 0,
    onChoose: (index) => {
      const hit = results[index];
      if (!hit) return;
      setQuery('');
      inputRef.current?.blur();
      navigate(`/${lang}/models/${hit.id}`);
    },
  });

  /** Every change of the text, typed or cleared, starts the list again from its first option. */
  const edit = (next: string) => {
    setQuery(next);
    combobox.textChanged();
  };

  // Pressing / focuses the search, unless the user is already typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, select, [contenteditable]');
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The hero example is the most registered model, read from the data.
  const example = popular[0];
  const placeholder =
    variant === 'hero' && example
      ? t('search.placeholderHero', { example: displayName(example.label) })
      : t('search.placeholder');

  return (
    <div className={`search search--${variant}`}>
      <label className="sr-only" htmlFor={combobox.inputId}>
        {t('search.label')}
      </label>
      <span className="search-icon">
        <Icon name="search" size={variant === 'hero' ? 24 : 20} />
      </span>
      <input
        {...combobox.inputProps}
        ref={inputRef}
        type="text"
        enterKeyHint="search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => edit(e.target.value)}
      />
      {query ? (
        <ClearButton
          onClick={() => {
            edit('');
            inputRef.current?.focus();
          }}
        />
      ) : (
        <kbd className="search-key" aria-hidden="true">
          /
        </kbd>
      )}
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
  );
}
