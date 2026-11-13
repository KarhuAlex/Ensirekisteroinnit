import { decodeCells, FUEL_GROUP_IDS, type CarFleet, type FleetCell } from '@regs/core';
import { useCallback, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SelectField } from '../../components/SelectField';
import { Section, Segmented, Skeleton, StatusPanel } from '../../components/ui';
import { useFleetCells } from '../../data/fleet';
import type { Geo } from '../../data/geo';
import { dataOf, type Remote } from '../../data/remote';
import { useI18n } from '../../i18n';
import {
  fleetAreaRows,
  fleetRegionRows,
  mapScaleTop,
  MIN_MAKE_CARS,
  MIN_MUNICIPALITY_CARS,
} from '../../lib/fleet';
import {
  cellsNeeded,
  chosenMake,
  fleetMakeAreaRows,
  fleetMakeOptions,
  groupCellsByMake,
  hasFewCars,
  makeScaleTop,
  shareRank,
  type FuelFilter,
  type MakeOption,
} from '../../lib/fleetMakes';
import type { FleetView } from '../../lib/fleetView';
import { FleetAreaCard } from './FleetAreaCard';
import { FleetAreaMakes } from './FleetAreaMakes';
import { FleetAreaTable } from './FleetAreaTable';
import { FleetMakeAreaCard } from './FleetMakeAreaCard';
import { FleetMakeAreaTable } from './FleetMakeAreaTable';
import { FleetMap } from './FleetMap';
import { electricShareData, makeShareData } from './mapData';
import { useFleetView, type FleetViewControls } from './useFleetView';

interface AreasProps {
  fleet: CarFleet;
  geo: Geo;
  view: FleetView;
  /** The controls over the map, which the view in use shares with the others. */
  tools: ReactNode;
  chooseArea: (id: string) => void;
  /** The cars of every make in every municipality; fetched once a make or an area is chosen. */
  cells: Remote<readonly FleetCell[]>;
}

const AREA_TITLE = { region: 'review.by.region', municipality: 'review.by.municipality' } as const;

/**
 * What choosing an area on the map does. The map has areas that the figures do not, such as a
 * municipality that has no cars, and choosing one of those does nothing.
 */
function useChooseKnownArea(rows: readonly { id: string }[], chooseArea: (id: string) => void) {
  const ids = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);
  return useCallback(
    (id: string) => {
      if (ids.has(id)) chooseArea(id);
    },
    [ids, chooseArea],
  );
}

/** The map, the figures of the chosen area and the table of areas, by electric share. */
function ElectricAreas({ fleet, geo, view, tools, chooseArea, cells }: AreasProps) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const rows = useMemo(
    () => (view.level === 'region' ? fleetRegionRows(fleet, geo) : fleetAreaRows(fleet)),
    [fleet, geo, view.level],
  );
  const data = useMemo(() => electricShareData(rows, view.share, i18n), [rows, view.share, i18n]);
  const selected = rows.find((row) => row.id === view.area) ?? null;
  const chooseOnMap = useChooseKnownArea(rows, chooseArea);
  const title = t('fleet.map.title', { date: fmt.date(fleet.date) });
  const noteSmall = t('fleet.map.noteSmall', { min: fmt.int(MIN_MUNICIPALITY_CARS) });

  return (
    <>
      <Section
        id="fleet-map"
        title={title}
        tools={tools}
        footnote={
          view.level === 'municipality'
            ? `${noteSmall} ${t('fleet.map.note')}`
            : t('fleet.map.note')
        }
      >
        <FleetMap
          data={data}
          scaleTop={mapScaleTop(rows, view.share)}
          level={view.level}
          geo={geo}
          title={title}
          selectedId={selected?.id ?? null}
          onSelect={chooseOnMap}
        />
        <FleetAreaCard row={selected} />
        {selected && (
          <FleetAreaMakes
            fleet={fleet}
            mapping={geo}
            level={view.level}
            area={selected}
            cells={cells}
          />
        )}
      </Section>
      <Section id="fleet-areas" title={t(AREA_TITLE[view.level])}>
        <FleetAreaTable rows={rows} selectedId={selected?.id ?? null} onSelect={chooseArea} />
      </Section>
    </>
  );
}

interface MakeAreasProps extends AreasProps {
  make: MakeOption;
  /** The cars of the make in the municipalities that have any. */
  makeCells: readonly FleetCell[];
}

/** The same for one make, which is shown as a share of the cars of each area. */
function MakeAreas({
  fleet,
  geo,
  view,
  tools,
  chooseArea,
  cells,
  make,
  makeCells,
}: MakeAreasProps) {
  const i18n = useI18n();
  const { t, fmt, lang } = i18n;
  const rows = useMemo(
    () => fleetMakeAreaRows(fleet, makeCells, view.fuel, view.level, geo),
    [fleet, makeCells, view.fuel, view.level, geo],
  );
  const data = useMemo(() => makeShareData(rows, make.name, i18n), [rows, make.name, i18n]);
  const selected = rows.find((row) => row.id === view.area) ?? null;
  const chooseOnMap = useChooseKnownArea(rows, chooseArea);
  const rank = selected ? shareRank(rows, selected.id) : null;
  const title = t('fleet.makeMap.title', { make: make.name, date: fmt.date(fleet.date) });
  const noteSmall = t('fleet.map.noteSmall', { min: fmt.int(MIN_MUNICIPALITY_CARS) });

  return (
    <>
      <Section
        id="fleet-map"
        title={title}
        tools={tools}
        lede={
          hasFewCars(make)
            ? `${t('fleet.map.note')} ${t('fleet.makeMap.fewCars', { min: fmt.int(MIN_MAKE_CARS) })}`
            : t('fleet.map.note')
        }
        footnote={
          <>
            {view.level === 'municipality' && `${noteSmall} `}
            {t('fleet.makeMap.note')}{' '}
            <Link to={`/${lang}/review`}>{t('fleet.makeMap.review')}</Link>.
          </>
        }
      >
        <FleetMap
          data={data}
          scaleTop={makeScaleTop(rows)}
          level={view.level}
          geo={geo}
          title={title}
          selectedId={selected?.id ?? null}
          onSelect={chooseOnMap}
        />
        <FleetMakeAreaCard row={selected} makeName={make.name} rank={rank} />
        {selected && (
          <FleetAreaMakes
            fleet={fleet}
            mapping={geo}
            level={view.level}
            area={selected}
            cells={cells}
          />
        )}
      </Section>
      <Section id="fleet-areas" title={t(AREA_TITLE[view.level])}>
        <FleetMakeAreaTable
          rows={rows}
          makeName={make.name}
          selectedId={selected?.id ?? null}
          onSelect={chooseArea}
        />
      </Section>
    </>
  );
}

interface ControlsProps {
  controls: FleetViewControls;
  /** The chosen make, if any. */
  make: MakeOption | null;
  makes: readonly MakeOption[];
}

/** The level, the make, and what is counted: the fuel of a make, or the electric share. */
function AreaControls({ controls, make, makes }: ControlsProps) {
  const { t, fmt } = useI18n();
  const { view, setLevel, setShare, setMake, setFuel } = controls;
  const fuelOptions: { value: FuelFilter; label: string }[] = [
    { value: 'all', label: t('fleet.fuel.all') },
    ...FUEL_GROUP_IDS.map((group) => ({ value: group, label: t(`fuel.group.${group}`) })),
  ];
  return (
    <>
      <Segmented
        label={t('review.areaBy')}
        value={view.level}
        options={[
          { value: 'region', label: t('review.by.region') },
          { value: 'municipality', label: t('review.by.municipality') },
        ]}
        onChange={setLevel}
      />
      <SelectField
        label={t('fleet.make')}
        value={make?.id ?? ''}
        options={[
          { value: '', label: t('fleet.make.all') },
          ...makes.map((option) => ({
            value: option.id,
            label: hasFewCars(option)
              ? t('fleet.make.fewCars', { name: option.name, min: fmt.int(MIN_MAKE_CARS) })
              : option.name,
          })),
        ]}
        onChange={(id) => setMake(id || null)}
      />
      {make ? (
        <SelectField
          label={t('fleet.fuel')}
          value={view.fuel}
          options={fuelOptions}
          onChange={setFuel}
        />
      ) : (
        <Segmented
          label={t('fleet.metric')}
          value={view.share}
          options={[
            { value: 'bev', label: t('chart.bevLine') },
            { value: 'plug', label: t('chart.plugLine') },
          ]}
          onChange={setShare}
        />
      )}
    </>
  );
}

/**
 * Where the cars are: the electric share of each area, or, once a make is chosen, the make's share
 * of the cars of each area. The choices are kept in the address.
 */
export function FleetAreas({ fleet, geo }: { fleet: CarFleet; geo: Geo }) {
  const { t, lang } = useI18n();
  const controls = useFleetView();
  const { view, chooseArea } = controls;
  const options = useMemo(
    () => fleetMakeOptions(fleet, (a, b) => a.localeCompare(b, lang)),
    [fleet, lang],
  );
  // A make the release does not have, such as one from an old link, is as if none was chosen.
  const make = chosenMake(options, view.make);
  // The cars of each make are fetched once they are needed: for a make, or for an area's makes.
  const file = useFleetCells(fleet.release, cellsNeeded(make, view.area));
  const cells = useMemo<Remote<readonly FleetCell[]>>(
    () => (file.status === 'ready' ? { status: 'ready', data: decodeCells(file.data) } : file),
    [file],
  );
  const loaded = dataOf(cells);
  const byMake = useMemo(() => (loaded ? groupCellsByMake(loaded) : null), [loaded]);

  const tools = <AreaControls controls={controls} make={make} makes={options} />;
  const shared = { fleet, geo, view, tools, chooseArea, cells };

  if (!make) return <ElectricAreas {...shared} />;
  if (byMake) return <MakeAreas {...shared} make={make} makeCells={byMake.get(make.id) ?? []} />;
  return (
    <Section id="fleet-map" title={make.name} tools={tools}>
      {file.status === 'loading' ? (
        <div className="loading" role="status" aria-label={t('status.loading')}>
          <Skeleton height={420} />
        </div>
      ) : (
        <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />
      )}
    </Section>
  );
}
