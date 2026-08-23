import type { ClimateDataset, ClimateSourceKind, ClimateStation } from '../types/climate-data-viewer.types';
import { parseGribBytes } from './grib2-parse.utils';
import { parseNetCdfBytes } from './netcdf-parse.utils';
import { minMaxVolume } from './volume-slice.utils';

const CLIMATE_MAX_CELLS = 2_000_000;

function asNumber(value: unknown, fallback = NaN): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function linspace(a: number, b: number, n: number): number[] {
  if (n <= 1) return [a];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.filter((v) => Number.isFinite(v)))].sort((a, b) => a - b);
}

function flattenGrid(value: unknown, expected: number): Float32Array<ArrayBufferLike> {
  const flat: number[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const n = asNumber(node);
    if (Number.isFinite(n)) flat.push(n);
  };
  walk(value);
  if (!flat.length) throw new Error('Climate grid is empty');
  if (flat.length > CLIMATE_MAX_CELLS) throw new Error('Climate grid is too large for in-browser preview');
  if (expected > 0 && flat.length !== expected) {
    const out = new Float32Array(expected);
    out.fill(NaN);
    out.set(flat.slice(0, expected));
    return out;
  }
  return new Float32Array(flat);
}

function finishDataset(partial: Omit<ClimateDataset, 'dataMin' | 'dataMax'> & { dataMin?: number; dataMax?: number }): ClimateDataset {
  const { min, max } = minMaxVolume(partial.grid.length ? partial.grid : Float32Array.from([0]));
  const stationMins = partial.stations.flatMap((s) => s.values);
  const all = stationMins.length ? Float32Array.from([...partial.grid, ...stationMins]) : partial.grid;
  const stats = all.length ? minMaxVolume(all) : { min, max };
  return {
    ...partial,
    dataMin: Number.isFinite(stats.min) ? stats.min : 0,
    dataMax: Number.isFinite(stats.max) ? stats.max : 1,
    warnings: [...partial.warnings]
  };
}

function parseStations(raw: unknown, nt: number, warnings: string[]): ClimateStation[] {
  if (!Array.isArray(raw)) return [];
  const stations: ClimateStation[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const rec = item as Record<string, unknown>;
    const valuesRaw = rec.values ?? rec.series ?? rec.data;
    const values = Array.isArray(valuesRaw) ? valuesRaw.map((v) => asNumber(v, NaN)) : [];
    if (values.length && values.length !== nt) {
      warnings.push(`Station ${asString(rec.id || rec.name, String(index))} series length ${values.length} ≠ ${nt} times`);
    }
    const aligned = new Array(nt).fill(NaN);
    for (let i = 0; i < Math.min(nt, values.length); i++) aligned[i] = values[i];
    stations.push({
      id: asString(rec.id, `st-${index + 1}`),
      name: asString(rec.name, asString(rec.id, `Station ${index + 1}`)),
      lat: asNumber(rec.lat ?? rec.latitude, NaN),
      lon: asNumber(rec.lon ?? rec.longitude ?? rec.lng, NaN),
      values: aligned
    });
  });
  return stations;
}

export function climateGridIndex(t: number, j: number, i: number, nx: number, ny: number): number {
  return t * ny * nx + j * nx + i;
}

export function extractClimateSlice(dataset: ClimateDataset, timeIndex: number): Float32Array {
  if (!dataset.nx || !dataset.ny) return new Float32Array(0);
  const t = Math.max(0, Math.min(dataset.nt - 1, timeIndex));
  const count = dataset.nx * dataset.ny;
  return dataset.grid.slice(t * count, t * count + count);
}

export function climateSpatialMeanSeries(dataset: ClimateDataset): number[] {
  if (!dataset.nx || !dataset.ny || !dataset.nt) return [];
  const count = dataset.nx * dataset.ny;
  return dataset.times.map((_, t) => {
    const slice = dataset.grid.subarray(t * count, t * count + count);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < slice.length; i++) {
      if (Number.isFinite(slice[i])) {
        sum += slice[i];
        n += 1;
      }
    }
    return n ? sum / n : NaN;
  });
}

export function isGribMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x52 && bytes[2] === 0x49 && bytes[3] === 0x42;
}

export function isNetcdfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x43 && bytes[1] === 0x44 && bytes[2] === 0x46;
}

export function climateFromGrib(bytes: Uint8Array): ClimateDataset {
  const parsed = parseGribBytes(bytes);
  if (!parsed.messages.length) throw new Error('No GRIB messages with decodable IEEE float fields');
  const first = parsed.messages[0];
  const sameShape = parsed.messages.filter((m) => m.ni === first.ni && m.nj === first.nj);
  const warnings = [...parsed.warnings];
  if (sameShape.length !== parsed.messages.length) {
    warnings.push('GRIB messages with mismatched grids were skipped; using the first grid size only.');
  }
  const nx = first.ni;
  const ny = first.nj;
  const nt = sameShape.length;
  const grid = new Float32Array(nt * ny * nx);
  sameShape.forEach((msg, t) => grid.set(msg.data, t * ny * nx));
  const times = sameShape.map((msg, i) => `${msg.parameterName} · msg ${i + 1}`);
  return finishDataset({
    name: first.parameterName || 'GRIB climate field',
    sourceKind: 'grib',
    variable: first.parameterName || 'field',
    longName: first.parameterName || 'GRIB field',
    unit: '',
    times,
    lats: linspace(first.lat1, first.lat2, ny),
    lons: linspace(first.lon1, first.lon2, nx),
    nx,
    ny,
    nt,
    grid,
    stations: [],
    warnings
  });
}

export function climateFromNetcdf(bytes: Uint8Array): ClimateDataset {
  const parsed = parseNetCdfBytes(bytes);
  const preview = parsed.preview;
  if (!preview) throw new Error('NetCDF file has no numeric variable preview');
  const [nx, ny, nz] = preview.viewDims;
  const dimNames = preview.dimNames.map((d) => d.toLowerCase());
  const timeDim = dimNames.findIndex((d) => d === 'time' || d === 't' || d.startsWith('time'));
  let nt = 1;
  let gridNx = nx;
  let gridNy = ny;
  if (preview.rank <= 2) {
    nt = 1;
  } else if (timeDim === 0 || dimNames[0] === 'time') {
    nt = preview.shape[0] || nz || 1;
    gridNy = preview.shape[1] || ny;
    gridNx = preview.shape[2] || nx;
  } else {
    nt = nz || 1;
  }
  const expected = nt * gridNy * gridNx;
  const grid = new Float32Array(expected);
  grid.set(preview.data.subarray(0, Math.min(preview.data.length, expected)));
  const times = Array.from({ length: nt }, (_, i) => `t${i + 1}`);
  const warnings = [...parsed.warnings];
  if (preview.rank > 3) warnings.push('NetCDF variable collapsed to a 3D climate preview.');
  return finishDataset({
    name: parsed.globalAttributes.find((a) => a.name === 'title')?.value || preview.variableName,
    sourceKind: 'netcdf',
    variable: preview.variableName,
    longName: preview.variableName,
    unit: '',
    times,
    lats: linspace(0, Math.max(gridNy - 1, 0), gridNy),
    lons: linspace(0, Math.max(gridNx - 1, 0), gridNx),
    nx: gridNx,
    ny: gridNy,
    nt,
    grid,
    stations: [],
    warnings
  });
}

function parseJsonClimate(text: string): ClimateDataset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid climate JSON');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Climate JSON must be an object');
  const rec = data as Record<string, unknown>;
  const timesRaw = rec.times ?? rec.time ?? rec.dates;
  const times = Array.isArray(timesRaw) ? timesRaw.map((t) => asString(t)) : ['t1'];
  const latRaw = rec.lats ?? rec.lat;
  const lonRaw = rec.lons ?? rec.lon;
  const lats = Array.isArray(latRaw) ? (latRaw as unknown[]).map((v: unknown) => asNumber(v)) : [];
  const lons = Array.isArray(lonRaw) ? (lonRaw as unknown[]).map((v: unknown) => asNumber(v)) : [];
  const warnings: string[] = [];
  const nt = Math.max(1, times.length);
  const ny = lats.length;
  const nx = lons.length;
  const stations = parseStations(rec.stations, nt, warnings);
  let grid: Float32Array<ArrayBufferLike> = new Float32Array(0);
  if (nx && ny) {
    grid = flattenGrid(rec.grid ?? rec.data ?? rec.values, nt * ny * nx);
    if (grid.length !== nt * ny * nx) warnings.push('Grid length did not match times × lats × lons; values were padded or truncated.');
  } else if (!stations.length) {
    throw new Error('Climate JSON needs lats/lons/grid or stations');
  } else {
    warnings.push('No gridded field — map view is empty; use Series or Stations.');
  }
  return finishDataset({
    name: asString(rec.name ?? rec.title, 'Climate dataset'),
    sourceKind: 'json',
    variable: asString(rec.variable ?? rec.var, 'tas'),
    longName: asString(rec.longName ?? rec.long_name, asString(rec.variable, 'Climate variable')),
    unit: asString(rec.unit ?? rec.units, ''),
    times,
    lats,
    lons,
    nx,
    ny,
    nt,
    grid,
    stations,
    warnings
  });
}

function parseCsvRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(',').map((cell) => cell.trim()));
}

function parseCsvClimate(text: string): ClimateDataset {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error('Climate CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase());
  const idx = (name: string): number => header.indexOf(name);
  const timeIdx = idx('time') >= 0 ? idx('time') : idx('date');
  const latIdx = idx('lat') >= 0 ? idx('lat') : idx('latitude');
  const lonIdx = idx('lon') >= 0 ? idx('lon') : idx('longitude') >= 0 ? idx('longitude') : idx('lng');
  const valueIdx = idx('value') >= 0 ? idx('value') : idx('tas') >= 0 ? idx('tas') : idx('temp');
  const stationIdx = idx('station') >= 0 ? idx('station') : idx('name');
  const warnings: string[] = [];

  if (stationIdx >= 0 && timeIdx >= 0 && valueIdx >= 0 && (latIdx < 0 || lonIdx < 0 || rows[0].length <= 5)) {
    const groups = new Map<string, ClimateStation>();
    const times: string[] = [];
    for (const row of rows.slice(1)) {
      const time = row[timeIdx] || '';
      if (time && !times.includes(time)) times.push(time);
    }
    for (const row of rows.slice(1)) {
      const id = row[stationIdx] || 'station';
      if (!groups.has(id)) {
        groups.set(id, {
          id,
          name: id,
          lat: latIdx >= 0 ? asNumber(row[latIdx]) : NaN,
          lon: lonIdx >= 0 ? asNumber(row[lonIdx]) : NaN,
          values: new Array(times.length).fill(NaN)
        });
      }
      const station = groups.get(id)!;
      const t = times.indexOf(row[timeIdx] || '');
      if (t >= 0) station.values[t] = asNumber(row[valueIdx]);
    }
    return finishDataset({
      name: 'Climate stations',
      sourceKind: 'csv',
      variable: header[valueIdx] || 'value',
      longName: header[valueIdx] || 'value',
      unit: '',
      times,
      lats: [],
      lons: [],
      nx: 0,
      ny: 0,
      nt: times.length,
      grid: new Float32Array(0),
      stations: [...groups.values()],
      warnings: ['CSV station table — no gridded map.']
    });
  }

  if (timeIdx < 0 || latIdx < 0 || lonIdx < 0 || valueIdx < 0) {
    throw new Error('Climate CSV needs time,lat,lon,value columns (or station,time,value)');
  }

  const records = rows.slice(1).map((row) => ({
    time: row[timeIdx] || '',
    lat: asNumber(row[latIdx]),
    lon: asNumber(row[lonIdx]),
    value: asNumber(row[valueIdx])
  }));
  const times = [...new Set(records.map((r) => r.time).filter(Boolean))];
  const lats = uniqueSorted(records.map((r) => r.lat));
  const lons = uniqueSorted(records.map((r) => r.lon));
  const nt = times.length;
  const ny = lats.length;
  const nx = lons.length;
  if (!nt || !ny || !nx) throw new Error('Climate CSV did not yield a time/lat/lon grid');
  const grid = new Float32Array(nt * ny * nx);
  grid.fill(NaN);
  let filled = 0;
  for (const rec of records) {
    const t = times.indexOf(rec.time);
    const j = lats.indexOf(rec.lat);
    const i = lons.indexOf(rec.lon);
    if (t < 0 || j < 0 || i < 0 || !Number.isFinite(rec.value)) continue;
    grid[climateGridIndex(t, j, i, nx, ny)] = rec.value;
    filled += 1;
  }
  if (filled < nt * ny * nx) warnings.push(`${nt * ny * nx - filled} grid cells are missing in the CSV.`);
  return finishDataset({
    name: 'Climate grid',
    sourceKind: 'csv',
    variable: header[valueIdx] || 'value',
    longName: header[valueIdx] || 'value',
    unit: '',
    times,
    lats,
    lons,
    nx,
    ny,
    nt,
    grid,
    stations: [],
    warnings
  });
}

function parseClimText(text: string): ClimateDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let name = 'Climate dataset';
  let variable = 'tas';
  let longName = 'Climate variable';
  let unit = '';
  let times: string[] = [];
  let lats: number[] = [];
  let lons: number[] = [];
  const stations: ClimateStation[] = [];
  const gridValues: number[] = [];
  let inGrid = false;
  for (const line of lines) {
    if (line.startsWith('# CLIMATE')) {
      name = line.replace(/^#\s*CLIMATE\s*/i, '').trim() || name;
      continue;
    }
    if (line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const key = parts[0]?.toUpperCase();
    if (key === 'VARIABLE' && parts.length >= 2) {
      variable = parts[1];
      unit = parts[parts.length - 1] && /°|[A-Za-z%/]/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : unit;
      longName = parts.slice(2, unit ? -1 : undefined).join(' ') || variable;
      inGrid = false;
      continue;
    }
    if (key === 'TIMES') {
      times = parts.slice(1);
      inGrid = false;
      continue;
    }
    if (key === 'LATS') {
      lats = parts.slice(1).map((v) => asNumber(v));
      inGrid = false;
      continue;
    }
    if (key === 'LONS') {
      lons = parts.slice(1).map((v) => asNumber(v));
      inGrid = false;
      continue;
    }
    if (key === 'GRID') {
      inGrid = true;
      continue;
    }
    if (key === 'STATION' && parts.length >= 5) {
      const values = parts.slice(5).map((v) => asNumber(v, NaN));
      stations.push({
        id: parts[1],
        name: parts[2].replace(/_/g, ' '),
        lat: asNumber(parts[3]),
        lon: asNumber(parts[4]),
        values
      });
      inGrid = false;
      continue;
    }
    if (inGrid) {
      for (const part of parts) {
        const n = asNumber(part);
        if (Number.isFinite(n)) gridValues.push(n);
      }
    }
  }
  if (!times.length) throw new Error('.clim file is missing TIMES');
  const nt = times.length;
  const ny = lats.length;
  const nx = lons.length;
  const expected = nt * ny * nx;
  const grid = expected ? flattenGrid(gridValues, expected) : new Float32Array(0);
  const warnings: string[] = [];
  stations.forEach((station) => {
    if (station.values.length !== nt) {
      warnings.push(`Station ${station.id} series length ≠ ${nt} times`);
      const aligned = new Array(nt).fill(NaN);
      station.values.forEach((v, i) => {
        if (i < nt) aligned[i] = v;
      });
      station.values = aligned;
    }
  });
  return finishDataset({
    name,
    sourceKind: 'clim',
    variable,
    longName,
    unit,
    times,
    lats,
    lons,
    nx,
    ny,
    nt,
    grid,
    stations,
    warnings
  });
}

export function parseClimateText(text: string, sourceHint: ClimateSourceKind = 'json'): ClimateDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Climate file is empty');
  if (trimmed.startsWith('{')) return parseJsonClimate(trimmed);
  if (/^#\s*CLIMATE/i.test(trimmed) || sourceHint === 'clim') return parseClimText(trimmed);
  if (trimmed.includes(',') || sourceHint === 'csv') return parseCsvClimate(trimmed);
  throw new Error('Unrecognized climate format — use NetCDF, GRIB, JSON, CSV, or .clim');
}

export function parseClimateBytes(bytes: Uint8Array, fileName: string): ClimateDataset {
  if (isGribMagic(bytes) || /\.(grib2?|grb2?)$/i.test(fileName)) return climateFromGrib(bytes);
  if (isNetcdfMagic(bytes) || /\.(nc|cdf|netcdf)$/i.test(fileName)) return climateFromNetcdf(bytes);
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  const hint: ClimateSourceKind = ext === 'csv' ? 'csv' : ext === 'clim' ? 'clim' : 'json';
  return parseClimateText(text, hint);
}
