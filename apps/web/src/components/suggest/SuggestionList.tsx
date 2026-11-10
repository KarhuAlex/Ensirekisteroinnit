import type { EntitySummary } from '@regs/core';
import { Fragment } from 'react';
import { useCatalog } from '../../data/DataProvider';
import { useI18n } from '../../i18n';
import { displayName } from '../../lib/names';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Highlight({ text, tokens }: { text: string; tokens: readonly string[] }) {
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

interface Props {
  /** Id of the list; option `i` has the id `${id}-${i}`. */
  id: string;
  entities: readonly EntitySummary[];
  tokens: readonly string[];
  active: number;
  onHover: (index: number) => void;
  onChoose: (index: number) => void;
}

/** The popup under a text field: matching makes, models and groups with their last 12 months. */
export function SuggestionList({ id, entities, tokens, active, onHover, onChoose }: Props) {
  const { byId } = useCatalog();
  const { t, fmt } = useI18n();
  const empty = tokens.length > 0 && entities.length === 0;

  return (
    <div className="suggest-pop">
      {tokens.length === 0 && <p className="suggest-head">{t('search.popular')}</p>}
      {empty ? (
        <div className="suggest-empty" role="status">
          <p>{t('search.empty')}</p>
          <p className="muted">{t('search.emptyHint')}</p>
        </div>
      ) : (
        <ul id={id} role="listbox" aria-label={t('search.results')}>
          {entities.map((e, i) => (
            <li
              key={e.id}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown rather than click: the input's blur would close the list before a click lands
              onMouseDown={(event) => {
                event.preventDefault();
                onChoose(i);
              }}
              onMouseEnter={() => onHover(i)}
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
  );
}
