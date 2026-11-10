import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useDataState } from '../data/DataProvider';
import { useI18n, type Lang, type MessageKey } from '../i18n';
import { STACK_ORDER } from '../lib/stats';
import { currentTheme, setTheme } from '../lib/theme';
import { FuelMark } from './FuelMark';
import { CanonicalLink } from './CanonicalLink';
import { Icon, type IconName } from './Icon';
import { SearchBox } from './SearchBox';
import { Skeleton, StatusPanel } from './ui';

interface NavItem {
  path: string;
  label: MessageKey;
  /** Shorter label for the tab bar. */
  short?: MessageKey;
  icon: IconName;
  end: boolean;
}

const NAV: NavItem[] = [
  { path: '', label: 'nav.overview', icon: 'overview', end: true },
  { path: '/review', label: 'nav.review', icon: 'review', end: false },
  { path: '/models', label: 'nav.models', icon: 'models', end: false },
  { path: '/table', label: 'nav.table', icon: 'table', end: false },
  { path: '/about', label: 'nav.about', short: 'nav.aboutShort', icon: 'info', end: false },
];

function Brand({ className }: { className?: string }) {
  const { lang, t } = useI18n();
  return (
    <Link to={`/${lang}`} className={className ? `brand ${className}` : 'brand'}>
      <img className="brand-mark" src="/favicon.svg" width={28} height={28} alt="" />
      <span className="brand-name">{t('app.title')}</span>
    </Link>
  );
}

function NavList({ variant }: { variant: 'rail' | 'tabs' }) {
  const { lang, t } = useI18n();
  return (
    <nav aria-label={t('nav.main')} className={variant === 'rail' ? 'nav' : 'tabbar'}>
      {NAV.map((item) => (
        <NavLink key={item.path} to={`/${lang}${item.path}`} end={item.end}>
          <Icon name={item.icon} size={variant === 'rail' ? 20 : 22} />
          <span>{t(variant === 'tabs' && item.short ? item.short : item.label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function FuelKey() {
  const { t } = useI18n();
  return (
    <div className="fuel-key">
      <p>{t('rail.fuelKey')}</p>
      <ul>
        {STACK_ORDER.map((g) => (
          <li key={g}>
            <FuelMark group={g} />
            {t(`fuel.group.${g}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setLocal] = useState(currentTheme);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setLocal(next);
  };
  return (
    <button
      type="button"
      className="tool-button"
      onClick={toggle}
      aria-label={t('theme.toggle')}
      title={t('theme.toggle')}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

function LangSwitch() {
  const { lang, t } = useI18n();
  const { pathname, search, hash } = useLocation();
  const other: Lang = lang === 'fi' ? 'en' : 'fi';
  const target = pathname.replace(/^\/(fi|en)(?=\/|$)/, `/${other}`) + search + hash;
  return (
    <Link
      to={target}
      className="tool-button tool-button--text"
      hrefLang={other}
      lang={other}
      aria-label={t('lang.switchLabel')}
    >
      {t('lang.switch')}
    </Link>
  );
}

function DataGate() {
  const { state, reload } = useDataState();
  const { t } = useI18n();
  if (state.status === 'loading') {
    return (
      <div className="loading" role="status" aria-label={t('status.loading')}>
        <Skeleton height={44} />
        <Skeleton height={72} />
        <Skeleton height={360} />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <StatusPanel
        tone="error"
        title={t('status.error')}
        hint={t('status.errorHint')}
        action={
          <button type="button" className="button button--primary" onClick={reload}>
            {t('status.retry')}
          </button>
        }
      />
    );
  }
  return <Outlet />;
}

export function Layout() {
  const { lang, t, fmt } = useI18n();
  const { value } = useDataState();
  const { pathname } = useLocation();
  const isHome = pathname.replace(/\/+$/, '') === `/${lang}`;

  return (
    <div className="app">
      <CanonicalLink />
      <a className="skip-link" href="#content">
        {t('skip.content')}
      </a>

      <aside className="rail">
        <Brand />
        <NavList variant="rail" />
        <FuelKey />
        {value && (
          <p className="rail-source">
            {t('footer.text', {
              licence: value.manifest.source.licence,
              updated: fmt.date(value.manifest.source.updated),
            })}
          </p>
        )}
      </aside>

      <div className="workspace">
        <header className="topbar">
          <Brand className="brand--top" />
          {value && !isHome && <SearchBox variant="compact" />}
          <div className="tools">
            <LangSwitch />
            <ThemeToggle />
          </div>
        </header>

        <main id="content" tabIndex={-1}>
          <DataGate />
        </main>

        <footer className="source-bar">
          {value ? (
            <>
              <span>
                {t('footer.text', {
                  licence: value.manifest.source.licence,
                  updated: fmt.date(value.manifest.source.updated),
                })}
              </span>
              <Link to={`/${lang}/about`}>{t('footer.limits')}</Link>
            </>
          ) : (
            <span>{t('app.tagline')}</span>
          )}
        </footer>
      </div>

      <NavList variant="tabs" />
    </div>
  );
}
