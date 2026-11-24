import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { Layout } from './components/Layout';
import { DataProvider } from './data/DataProvider';
import { SiteConfigProvider } from './data/SiteConfigProvider';
import { I18nProvider, isLang } from './i18n';
import { withDefaultLang } from './lib/langPath';
import { About } from './pages/About';
import { Compare } from './pages/Compare';
import { ModelDetail } from './pages/ModelDetail';
import { Models } from './pages/Models';
import { NotFound } from './pages/NotFound';
import { Fleet } from './pages/Fleet';
import { Forecast } from './pages/Forecast';
import { Overview } from './pages/Overview';
import { Review } from './pages/Review';
import { TablePage } from './pages/TablePage';

/** Opens the address in the default language when it has no language of its own. */
function ToDefaultLang() {
  return <Navigate to={withDefaultLang(useLocation())} replace />;
}

function LangRoute() {
  const { lang } = useParams();
  if (!isLang(lang)) return <ToDefaultLang />;
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
            <Route path="/" element={<ToDefaultLang />} />
            <Route path="/:lang" element={<LangRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="review" element={<Review />} />
                <Route path="models" element={<Models />} />
                <Route path="models/:id" element={<ModelDetail />} />
                <Route path="compare" element={<Compare />} />
                <Route path="stock" element={<Fleet />} />
                <Route path="forecast" element={<Forecast />} />
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
