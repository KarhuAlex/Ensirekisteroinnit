import { Link } from 'react-router-dom';
import type { ElectrificationSummary } from '../lib/electrification';
import { useI18n } from '../i18n';
import { NBSP } from '../lib/format';
import type { LatestStock } from '../lib/stock';
import { STACK_ORDER, toneOf } from '../lib/stats';
import { FuelDonut } from './FuelDonut';
import { FuelMark } from './FuelMark';
import { Icon } from './Icon';

interface Props {
  summary: Pick<ElectrificationSummary, 'mixNow' | 'bevNow' | 'bevDelta' | 'bev12'>;
  month: string;
  /** The electric share of all cars in traffic, shown below the share of new cars once published. */
  stock?: LatestStock | null;
  /** The stock is still loading. */
  stockPending?: boolean;
  /** The car fleet page has data, so the line may link to it. */
  fleetLink?: boolean;
}

/** The overview's opening figure: the latest month's fuel mix, with the electric share in the middle. */
export function BevHero({ summary, month, stock, stockPending = false, fleetLink = false }: Props) {
  const { t, fmt } = useI18n();
  const { mixNow, bevNow, bevDelta, bev12 } = summary;
  if (bevNow === null) {
    return <h1 className="bev-hero-eyebrow">{t('hero.noData', { month })}</h1>;
  }

  const legend = STACK_ORDER.map((group) => ({
    group,
    name: t(`fuel.group.${group}`),
    share: fmt.pct(mixNow[group]),
  }));
  const spoken = legend.map(({ name, share }) => `${name} ${share}`).join(', ');
  const tone = toneOf(bevDelta);

  return (
    <section className="bev-hero" aria-labelledby="bev-hero-title">
      <FuelDonut mix={mixNow} ariaLabel={t('hero.aria', { month, items: spoken })}>
        <span className="donut-value">{fmt.pct(bevNow)}</span>
        <span className="donut-label">{t('hero.donutLabel')}</span>
      </FuelDonut>

      <div className="bev-hero-body">
        <h1 id="bev-hero-title" className="bev-hero-eyebrow">
          {t('hero.eyebrow', { month })}
        </h1>
        {bevDelta !== null && (
          <p className={`bev-hero-delta change--${tone}`}>
            {tone !== 'neutral' && <Icon name={bevDelta > 0 ? 'arrowUp' : 'arrowDown'} size={28} />}
            <span>{fmt.signed(bevDelta, `${NBSP}${t('unit.pp')}`)}</span>
            <small>{t('hero.perYear')}</small>
          </p>
        )}
        <p className="bev-hero-year">{t('hero.share12', { share12: fmt.pct(bev12) })}</p>
        <StockLine stock={stock} pending={stockPending} link={fleetLink} />
        <ul className="bev-hero-legend">
          {legend.map(({ group, name, share }) => (
            <li key={group}>
              <FuelMark group={group} />
              <span>{name}</span>
              <strong>{share}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The electric share of all cars in traffic. While it loads, an empty line keeps the hero from jumping. */
function StockLine({
  stock,
  pending,
  link,
}: {
  stock?: LatestStock | null;
  pending: boolean;
  link: boolean;
}) {
  const { lang, t, fmt } = useI18n();
  if (stock) {
    return (
      <p className="bev-hero-year">
        {t('hero.stock', { share: fmt.pct(stock.bevShare), date: fmt.date(stock.date) })}
        {link && (
          <>
            {' '}
            <Link to={`/${lang}/stock`}>{t('hero.stockLink')}</Link>
          </>
        )}
      </p>
    );
  }
  return pending ? (
    <p className="bev-hero-year" aria-hidden="true">
      {NBSP}
    </p>
  ) : null;
}
