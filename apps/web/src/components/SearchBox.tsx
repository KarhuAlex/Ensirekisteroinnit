import type { EntitySummary } from '@regs/core';
import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../data/DataProvider';
import { useI18n } from '../i18n';
import { displayName } from '../lib/names';
import { Icon } from './Icon';

const MAX_RESULTS = 8;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{i % 2 === 1 ? <mark>{part}</mark> : part}</Fragment>
      ))}
    </>
  );
}

/** `hero` is the front door on the overview; `compact` sits in the top bar. */
export function SearchBox({ variant }: { variant: 'hero' | 'compact' }) {
  const { entities, byId } = useCatalog();
  const { lang, t, fmt } = useI18n();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const popular = usePopularModels(MAX_RESULTS);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // With an empty query the list only holds suggestions, so Enter needs an option the user
  // moved to.
  const [picked, setPicked] = useState(false);

  const tokens = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const results = useMemo(() => {
    if (tokens.length === 0) return popular;
    return entities
      .filter(
        (e) => e.kind !== 'total' && tokens.every((tok) => e.label.toLowerCase().includes(tok)),
      )
      .sort((a, b) => b.last12 - a.last12 || b.total - a.total)
      .slice(0, MAX_RESULTS);
  }, [entities, popular, tokens]);

  // Pressing / focuses the search, unless the user is already typing.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
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

  const choose = (id: string) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    navigate(`/${lang}/models/${id}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setPicked(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setPicked(true);
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      const hit = results[active];
      if (hit && open && (picked || tokens.length > 0)) {
        event.preventDefault();
        choose(hit.id);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  // The hero example is the most registered model, read from the data.
  const example = popular[0];
  const placeholder =
    variant === 'hero' && example
      ? t('search.placeholderHero', { example: displayName(example.label) })
      : t('search.placeholder');

  const showList = open;
  const empty = tokens.length > 0 && results.length === 0;

  return (
    <div className={`search search--${variant}`}>
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {t('search.label')}
      </label>
      <span className="search-icon">
        <Icon name="search" size={variant === 'hero' ? 24 : 20} />
      </span>
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setPicked(false);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {query ? (
        <button
          type="button"
          className="search-clear"
          aria-label={t('search.clear')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery('');
            inputRef.current?.focus();
          }}
        >
          <Icon name="close" size={18} />
        </button>
      ) : (
        <kbd className="search-key" aria-hidden="true">
          /
        </kbd>
      )}
      {showList && (
        <div className="search-pop">
          {tokens.length === 0 && <p className="search-head">{t('search.popular')}</p>}
          {empty ? (
            <div className="search-empty" role="status">
              <p>{t('search.empty')}</p>
              <p className="muted">{t('search.emptyHint')}</p>
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label={t('search.results')}>
              {results.map((e, i) => (
                <li
                  key={e.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown rather than click: the input's blur would close the list before a click lands
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    choose(e.id);
                  }}
                  onMouseEnter={() => {
                    setActive(i);
                    setPicked(true);
                  }}
                >
                  <span className="result-main">
                    <span className="result-name">
                      <Highlight text={displayName(e.label)} tokens={tokens} />
                    </span>
                    <span className="result-meta">
                      {t(`kind.${e.kind}`)}
                      {e.makeId && byId.get(e.makeId)
                        ? ` · ${displayName(byId.get(e.makeId)?.label ?? '')}`
                        : ''}
                    </span>
                  </span>
                  <span className="result-count">
                    {fmt.int(e.last12)}
                    <small>{t('search.per12')}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
