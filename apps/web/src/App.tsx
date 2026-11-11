import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DataProvider } from './data/DataProvider';
import { SiteConfigProvider } from './data/SiteConfigProvider';
import { detectLang, I18nProvider, isLang } from './i18n';
import { About } from './pages/About';
import { Compare } from './pages/Compare';
import { ModelDetail } from './pages/ModelDetail';
import { Models } from './pages/Models';
import { NotFound } from './pages/NotFound';
import { Fleet } from './pages/Fleet';
import { Overview } from './pages/Overview';
import { Review } from './pages/Review';
import { TablePage } from './pages/TablePage';

function LangRoute() {
  const { lang } = useParams();
  if (!isLang(lang)) return <Navigate to={`/${detectLang()}`} replace />;
  return (
    <I18nProvider lang={lang}>
      <Outlet />
    </I18nProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SiteConfigProvider>
        <DataProvider>
          <Routes>
            <Route path="/" element={<Navigate to={`/${detectLang()}`} replace />} />
            <Route path="/:lang" element={<LangRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="review" element={<Review />} />
                <Route path="models" element={<Models />} />
                <Route path="models/:id" element={<ModelDetail />} />
                <Route path="compare" element={<Compare />} />
                <Route path="stock" element={<Fleet />} />
                <Route path="table" element={<TablePage />} />
                <Route path="about" element={<About />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </DataProvider>
      </SiteConfigProvider>
    </BrowserRouter>
  );
}
