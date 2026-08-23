/** Synthetic Horn of Africa monthly TAS sample (education / research). */

export interface ClimateSampleObject {
  name: string;
  source: string;
  variable: string;
  longName: string;
  unit: string;
  lats: number[];
  lons: number[];
  times: string[];
  grid: number[];
  stations: Array<{ id: string; name: string; lat: number; lon: number; values: number[] }>;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function tasAt(lat: number, lon: number, monthIndex: number): number {
  const seasonal = 5 * Math.cos((2 * Math.PI * (monthIndex - 1)) / 12);
  const highland = Math.exp(-((lat - 9) ** 2 + (lon - 39) ** 2) / 18) * 8;
  return 24 - 0.35 * (lat - 3) - highland + seasonal;
}

export function buildClimateSampleObject(): ClimateSampleObject {
  const lats = [3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5];
  const lons = [33, 35, 37, 39, 41, 43, 45, 47];
  const times: string[] = [];
  for (let year = 2020; year <= 2021; year++) {
    for (let month = 1; month <= 12; month++) {
      times.push(`${year}-${String(month).padStart(2, '0')}`);
    }
  }
  const grid: number[] = [];
  for (let t = 0; t < times.length; t++) {
    const month = t % 12;
    for (let j = 0; j < lats.length; j++) {
      for (let i = 0; i < lons.length; i++) {
        grid.push(round2(tasAt(lats[j], lons[i], month) + 0.35 * Math.sin(i + j + t * 0.3)));
      }
    }
  }
  const stationMeta = [
    { id: 'ADD', name: 'Addis Ababa', lat: 9.03, lon: 38.74 },
    { id: 'DIR', name: 'Dire Dawa', lat: 9.6, lon: 41.87 },
    { id: 'BIR', name: 'Bahir Dar', lat: 11.6, lon: 37.38 }
  ];
  return {
    name: 'Ethiopia monthly TAS 2020–2021',
    source: 'Synthetic education sample',
    variable: 'tas',
    longName: 'Near-surface air temperature',
    unit: '°C',
    lats,
    lons,
    times,
    grid,
    stations: stationMeta.map((station) => ({
      ...station,
      values: times.map((_, t) => round2(tasAt(station.lat, station.lon, t % 12)))
    }))
  };
}

export const CLIMATE_JSON_SAMPLE = JSON.stringify(buildClimateSampleObject(), null, 2);

export const CLIMATE_CSV_SAMPLE = [
  'time,lat,lon,value',
  '2020-01,6,36,23.10',
  '2020-01,6,40,22.40',
  '2020-01,10,36,21.20',
  '2020-01,10,40,19.80',
  '2020-02,6,36,24.00',
  '2020-02,6,40,23.20',
  '2020-02,10,36,22.10',
  '2020-02,10,40,20.70',
  '2020-03,6,36,25.40',
  '2020-03,6,40,24.60',
  '2020-03,10,36,23.50',
  '2020-03,10,40,22.10'
].join('\n');

export const CLIMATE_CLIM_SAMPLE = `# CLIMATE Horn of Africa TAS
VARIABLE tas Near-surface air temperature °C
TIMES 2020-01 2020-02 2020-03
LATS 6 10
LONS 36 40
GRID
23.1 22.4
21.2 19.8
24.0 23.2
22.1 20.7
25.4 24.6
23.5 22.1
STATION ADD Addis_Ababa 9.03 38.74 18.9 19.8 21.1
`;
