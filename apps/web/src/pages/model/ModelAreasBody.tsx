import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import {
  listedAreas,
  MIN_AREA_COUNT,
  MIN_ENTITY_COUNT,
  type EntityAreas,
} from '../../lib/entityAreas';
import type { PeriodSpan } from '../../lib/regionalRanking';
import { ModelAreasTable } from './ModelAreasTable';

interface Props {
  areas: EntityAreas;
  /** The months the figures are of. */
  span: PeriodSpan;
  /** The review's area view of the same make or model; `null` if the span is not in its months. */
  reviewPath: string | null;
  /** The Autokanta page of the make; `null` for a model or a make that page does not have. */
  stockPath: string | null;
}

/** The regions in order of the share, with the notes and the links to the fuller views. */
export function ModelAreasBody({ areas, span, reviewPath, stockPath }: Props) {
  const { t, fmt } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const links = (
    <p className="footnote">
      {reviewPath && <Link to={reviewPath}>{t('model.areas.review')}</Link>}
      {reviewPath && stockPath && ' · '}
      {stockPath && <Link to={stockPath}>{t('model.areas.stock')}</Link>}
    </p>
  );
  if (areas.kind !== 'ready') {
    const message =
      areas.kind === 'too-few'
        ? t('model.areas.tooFew', { min: fmt.int(MIN_ENTITY_COUNT) })
        : t('model.areas.thin', { min: fmt.int(MIN_AREA_COUNT) });
    return (
      <>
        <p className="muted">{message}</p>
        {links}
      </>
    );
  }

  const listed = listedAreas(areas, expanded);
  const notes = [
    t('model.areas.note'),
    ...(areas.small.length > 0
      ? [t('model.areas.noteSmall', { min: fmt.int(MIN_AREA_COUNT) })]
      : []),
  ];
  return (
    <>
      <p className="lede">
        {t('model.areas.lede', {
          from: fmt.month(span.from),
          to: fmt.month(span.to),
          share: fmt.pct(areas.national.share),
        })}
      </p>
      <ModelAreasTable ranked={listed.ranked} small={listed.small} />
      {listed.canExpand && (
        <button type="button" className="button" onClick={() => setExpanded((open) => !open)}>
          {t(expanded ? 'model.areas.showTop' : 'model.areas.showAll')}
        </button>
      )}
      <p className="footnote">{notes.join(' ')}</p>
      {links}
    </>
  );
}
