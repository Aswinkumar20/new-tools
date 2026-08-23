import type {
  BoreholeLithInterval,
  BoreholeMarker,
  BoreholeSurveyRow,
  ParsedBorehole
} from '../types/borehole-viewer.types';

const DEG = Math.PI / 180;
const LITH_COLORS = ['#eab308', '#f59e0b', '#d97706', '#64748b', '#a8a29e', '#44403c', '#0f766e'];

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.eE+-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function colorFor(index: number, explicit?: string): string {
  if (explicit && /^#?[0-9a-fA-F]{3,8}$/.test(explicit)) return explicit.startsWith('#') ? explicit : `#${explicit}`;
  return LITH_COLORS[index % LITH_COLORS.length];
}

function toRad(deg: number): number {
  return deg * DEG;
}

/** Minimum-curvature survey → TVD / N / E / VS / DLS (deg/30m). */
export function computeTrajectory(
  stations: Array<{ md: number; inc: number; azi: number }>,
  sectionAzimuth = 0
): BoreholeSurveyRow[] {
  const sorted = [...stations]
    .map((s, i) => ({ index: i, md: asNumber(s.md), inc: asNumber(s.inc), azi: asNumber(s.azi) }))
    .filter((s) => Number.isFinite(s.md))
    .sort((a, b) => a.md - b.md);
  if (!sorted.length) return [];

  const out: BoreholeSurveyRow[] = [];
  let tvd = 0;
  let north = 0;
  let east = 0;
  const az0 = toRad(sectionAzimuth);

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    let dls = 0;
    if (i > 0) {
      const prev = sorted[i - 1];
      const dMd = cur.md - prev.md;
      const i1 = toRad(prev.inc);
      const i2 = toRad(cur.inc);
      const a1 = toRad(prev.azi);
      const a2 = toRad(cur.azi);
      let cosb = Math.cos(i2 - i1) - Math.sin(i1) * Math.sin(i2) * (1 - Math.cos(a2 - a1));
      cosb = Math.max(-1, Math.min(1, cosb));
      const beta = Math.acos(cosb);
      const rf = Math.abs(beta) > 1e-8 ? (2 / beta) * Math.tan(beta / 2) : 1;
      north += (dMd / 2) * (Math.sin(i1) * Math.cos(a1) + Math.sin(i2) * Math.cos(a2)) * rf;
      east += (dMd / 2) * (Math.sin(i1) * Math.sin(a1) + Math.sin(i2) * Math.sin(a2)) * rf;
      tvd += (dMd / 2) * (Math.cos(i1) + Math.cos(i2)) * rf;
      dls = dMd > 0 ? ((beta / DEG) / dMd) * 30 : 0;
    }
    const vs = north * Math.cos(az0) + east * Math.sin(az0);
    out.push({
      index: i,
      md: cur.md,
      inc: cur.inc,
      azi: cur.azi,
      tvd,
      north,
      east,
      vs,
      dls
    });
  }
  return out;
}

function parseLith(raw: Record<string, unknown>, index: number): BoreholeLithInterval {
  const top = asNumber(raw['topMd'] ?? raw['top'] ?? raw['from'] ?? raw['mdTop']);
  const base = asNumber(raw['baseMd'] ?? raw['base'] ?? raw['to'] ?? raw['mdBase'], top + 10);
  return {
    id: asString(raw['id'], `L${index + 1}`),
    name: asString(raw['name'] ?? raw['unit'], `Interval ${index + 1}`),
    lithology: asString(raw['lithology'] ?? raw['lith'], ''),
    topMd: Math.min(top, base),
    baseMd: Math.max(top, base),
    color: colorFor(index, asString(raw['color'], '')),
    description: asString(raw['description'] ?? raw['desc'], '')
  };
}

function parseMarker(raw: Record<string, unknown>, index: number): BoreholeMarker {
  return {
    id: asString(raw['id'], `M${index + 1}`),
    name: asString(raw['name'], `Marker ${index + 1}`),
    md: asNumber(raw['md'] ?? raw['depth'])
  };
}

function finalize(
  name: string,
  well: string,
  kb: number,
  unit: string,
  sourceKind: ParsedBorehole['sourceKind'],
  stations: Array<{ md: number; inc: number; azi: number }>,
  lithology: BoreholeLithInterval[],
  markers: BoreholeMarker[],
  extraWarnings: string[] = []
): ParsedBorehole {
  const warnings = [...extraWarnings];
  if (stations.length < 2) throw new Error('Need at least two survey stations (MD / INC / AZI).');
  const survey = computeTrajectory(stations);
  const last = survey[survey.length - 1];
  const disp = Math.sqrt(last.north * last.north + last.east * last.east);
  const maxDls = Math.max(0, ...survey.map((s) => s.dls));
  if (!lithology.length) warnings.push('No lithology intervals — trajectory only.');
  if (survey.some((s) => s.inc < 0 || s.inc > 180)) warnings.push('Some inclinations are outside 0–180°.');
  return {
    name,
    well: well || name,
    kb,
    unit,
    sourceKind,
    survey,
    lithology,
    markers,
    td: last.md,
    tvd: last.tvd,
    displacement: disp,
    maxDls,
    warnings
  };
}

function parseJsonBorehole(json: Record<string, unknown>): ParsedBorehole {
  const wells = Array.isArray(json['wells']) ? json['wells'] : null;
  const src = wells && wells[0] && typeof wells[0] === 'object' ? (wells[0] as Record<string, unknown>) : json;
  const surveyRaw = Array.isArray(src['survey'])
    ? src['survey']
    : Array.isArray(src['stations'])
      ? src['stations']
      : Array.isArray(json['survey'])
        ? json['survey']
        : [];
  const lithRaw = Array.isArray(src['lithology'])
    ? src['lithology']
    : Array.isArray(src['intervals'])
      ? src['intervals']
      : Array.isArray(json['lithology'])
        ? json['lithology']
        : [];
  const markerRaw = Array.isArray(src['markers']) ? src['markers'] : Array.isArray(json['markers']) ? json['markers'] : [];
  const stations = surveyRaw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      md: asNumber(s['md'] ?? s['measuredDepth'] ?? s['depth']),
      inc: asNumber(s['inc'] ?? s['inclination'] ?? s['dip']),
      azi: asNumber(s['azi'] ?? s['azimuth'] ?? s['az'])
    }));
  const lithology = lithRaw
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l, i) => parseLith(l, i));
  const markers = markerRaw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map((m, i) => parseMarker(m, i));
  return finalize(
    asString(src['name'] ?? json['name'], 'Borehole'),
    asString(src['well'] ?? src['wellName'] ?? json['well'], ''),
    asNumber(src['kb'] ?? src['kellyBushing'] ?? json['kb']),
    asString(src['unit'] ?? json['unit'], 'm'),
    'json',
    stations,
    lithology,
    markers
  );
}

function parseCsvBorehole(text: string): ParsedBorehole {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('CSV needs a header and at least two survey rows.');
  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const iMd = Math.max(idx(['md', 'measured', 'depth']), 0);
  const iInc = idx(['inc', 'incl', 'dip']);
  const iAzi = idx(['azi', 'azim', 'azimuth']);
  const iName = idx(['lith', 'unit', 'name']);
  const iTop = idx(['top', 'from']);
  const iBase = idx(['base', 'to', 'bottom']);
  const iColor = idx(['color']);
  if (iInc < 0 || iAzi < 0) throw new Error('CSV must include MD, INC, and AZI columns (or lithology top/base).');

  const stations: Array<{ md: number; inc: number; azi: number }> = [];
  const lithology: BoreholeLithInterval[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (iTop >= 0 && iBase >= 0 && iName >= 0 && cols[iTop] !== '' && cols[iBase] !== '' && !cols[iInc]) {
      lithology.push(
        parseLith({ name: cols[iName], topMd: cols[iTop], baseMd: cols[iBase], color: iColor >= 0 ? cols[iColor] : '' }, lithology.length)
      );
      continue;
    }
    stations.push({ md: asNumber(cols[iMd]), inc: asNumber(cols[iInc]), azi: asNumber(cols[iAzi]) });
  }
  return finalize('CSV borehole', 'CSV borehole', 0, 'm', 'csv', stations, lithology, [], lithology.length ? [] : ['CSV import is a deviation survey — add lithology columns for intervals.']);
}

function parseBhlText(text: string): ParsedBorehole {
  let name = 'Borehole';
  let well = '';
  let kb = 0;
  let unit = 'm';
  let section: 'SURVEY' | 'LITHO' | 'MARKER' | '' = '';
  const stations: Array<{ md: number; inc: number; azi: number }> = [];
  const lithology: BoreholeLithInterval[] = [];
  const markers: BoreholeMarker[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const key = parts[0].toUpperCase();
    if (key === 'NAME') name = parts.slice(1).join(' ') || name;
    else if (key === 'WELL') well = parts.slice(1).join(' ') || well;
    else if (key === 'KB') kb = asNumber(parts[1]);
    else if (key === 'UNIT') unit = parts[1] || unit;
    else if (key === 'SURVEY') section = 'SURVEY';
    else if (key === 'LITHO' || key === 'LITHOLOGY') section = 'LITHO';
    else if (key === 'MARKER' && parts.length >= 3 && Number.isNaN(Number(parts[1]))) {
      markers.push({ id: `M${markers.length + 1}`, name: parts[1].replace(/_/g, ' '), md: asNumber(parts[2]) });
    } else if (key === 'MARKERS') section = 'MARKER';
    else if (section === 'SURVEY' && parts.length >= 3) {
      stations.push({ md: asNumber(parts[0]), inc: asNumber(parts[1]), azi: asNumber(parts[2]) });
    } else if (section === 'LITHO' && parts.length >= 3) {
      lithology.push(
        parseLith(
          { name: parts[2]?.replace(/_/g, ' '), lithology: parts[2]?.replace(/_/g, ' '), topMd: parts[0], baseMd: parts[1], color: parts[3] || '' },
          lithology.length
        )
      );
    } else if (section === 'MARKER' && parts.length >= 2) {
      markers.push({ id: `M${markers.length + 1}`, name: parts[0].replace(/_/g, ' '), md: asNumber(parts[1]) });
    }
  }
  return finalize(name, well, kb, unit, 'bhl', stations, lithology, markers);
}

export function parseBoreholeText(text: string): ParsedBorehole {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('File is empty');
  if (raw.startsWith('{')) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error('Invalid JSON borehole file.');
    }
    if (!json || typeof json !== 'object') throw new Error('JSON borehole must be an object.');
    return parseJsonBorehole(json as Record<string, unknown>);
  }
  if (/^\s*#?\s*BOREHOLE/i.test(raw) || (/^\s*NAME\s+/im.test(raw) && /^\s*SURVEY\b/im.test(raw))) {
    return parseBhlText(raw);
  }
  const header = raw.split('\n')[0] || '';
  if (/[,;\t]/.test(header) && /md|inc|azi|depth|incl/i.test(header)) {
    const parsed = parseCsvBorehole(raw);
    return { ...parsed, sourceKind: /dev/i.test(header) ? 'dev' : 'csv' };
  }
  throw new Error('Unrecognized borehole file — use JSON, CSV deviation (MD/INC/AZI), or .bhl text.');
}
