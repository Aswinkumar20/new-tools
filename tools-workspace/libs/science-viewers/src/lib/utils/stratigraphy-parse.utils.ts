import type {
  ParsedStratigraphy,
  StratigraphyColumn,
  StratigraphyMarker,
  StratigraphyUnit
} from '../types/stratigraphy-viewer.types';

const UNIT_COLORS = ['#eab308', '#f59e0b', '#d97706', '#64748b', '#a8a29e', '#44403c', '#7c3aed', '#0f766e'];

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function colorFor(index: number, explicit?: string): string {
  if (explicit && /^#?[0-9a-fA-F]{3,8}$/.test(explicit)) return explicit.startsWith('#') ? explicit : `#${explicit}`;
  return UNIT_COLORS[index % UNIT_COLORS.length];
}

function parseUnit(raw: Record<string, unknown>, index: number): StratigraphyUnit {
  const ageTop = asNumber(raw['ageTop'] ?? raw['topAge'] ?? raw['age_top']);
  const ageBase = asNumber(raw['ageBase'] ?? raw['baseAge'] ?? raw['age_base'], ageTop + 1);
  return {
    id: asString(raw['id'], `U${index + 1}`),
    name: asString(raw['name'] ?? raw['unit'], `Unit ${index + 1}`),
    lithology: asString(raw['lithology'] ?? raw['lith'], ''),
    era: asString(raw['era'], ''),
    period: asString(raw['period'] ?? raw['age'], ''),
    ageTop: Math.min(ageTop, ageBase),
    ageBase: Math.max(ageTop, ageBase),
    thickness: Math.max(0, asNumber(raw['thickness'] ?? raw['thick'], ageBase - ageTop)),
    color: colorFor(index, asString(raw['color'], '')),
    unconformity: Boolean(raw['unconformity'] ?? raw['hiatus']),
    description: asString(raw['description'] ?? raw['desc'], '')
  };
}

function parseMarker(raw: Record<string, unknown>, index: number): StratigraphyMarker {
  return {
    id: asString(raw['id'], `M${index + 1}`),
    name: asString(raw['name'], `Marker ${index + 1}`),
    age: asNumber(raw['age'] ?? raw['ma']),
    kind: asString(raw['kind'] ?? raw['type'], 'boundary')
  };
}

function finalize(
  name: string,
  region: string,
  unit: string,
  timeUnit: string,
  sourceKind: ParsedStratigraphy['sourceKind'],
  columns: StratigraphyColumn[],
  markers: StratigraphyMarker[],
  extraWarnings: string[] = []
): ParsedStratigraphy {
  if (!columns.length || columns.every((c) => !c.units.length)) {
    throw new Error('No stratigraphic units found.');
  }
  const warnings = [...extraWarnings];
  const ages = columns.flatMap((c) => c.units.flatMap((u) => [u.ageTop, u.ageBase]));
  if (columns.length === 1) warnings.push('Single column — add another column for correlation view.');
  return {
    name,
    region,
    unit,
    timeUnit,
    sourceKind,
    columns,
    markers,
    ageMin: Math.min(...ages),
    ageMax: Math.max(...ages),
    warnings
  };
}

function parseJsonStrat(json: Record<string, unknown>): ParsedStratigraphy {
  const columnsRaw = Array.isArray(json['columns']) ? json['columns'] : null;
  const unitsRaw = Array.isArray(json['units']) ? json['units'] : Array.isArray(json['layers']) ? json['layers'] : [];
  const markersRaw = Array.isArray(json['markers']) ? json['markers'] : [];
  let columns: StratigraphyColumn[] = [];
  if (columnsRaw?.length) {
    columns = columnsRaw
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map((c, i) => {
        const units = (Array.isArray(c['units']) ? c['units'] : [])
          .filter((u): u is Record<string, unknown> => !!u && typeof u === 'object')
          .map((u, ui) => parseUnit(u, ui));
        return { id: asString(c['id'], `C${i + 1}`), name: asString(c['name'], `Column ${i + 1}`), units };
      });
  } else if (unitsRaw.length) {
    columns = [
      {
        id: 'C1',
        name: asString(json['name'], 'Composite'),
        units: unitsRaw.filter((u): u is Record<string, unknown> => !!u && typeof u === 'object').map((u, i) => parseUnit(u, i))
      }
    ];
  }
  const markers = markersRaw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map((m, i) => parseMarker(m, i));
  return finalize(
    asString(json['name'], 'Stratigraphy'),
    asString(json['region'] ?? json['area'], ''),
    asString(json['unit'] ?? json['depthUnit'], 'm'),
    asString(json['timeUnit'] ?? json['ageUnit'], 'Ma'),
    'json',
    columns,
    markers
  );
}

function parseCsvStrat(text: string): ParsedStratigraphy {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('CSV needs a header and at least one unit row.');
  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const iName = Math.max(idx(['unit', 'name', 'layer']), 0);
  const iLith = idx(['lith']);
  const iPeriod = idx(['period', 'age']);
  const iEra = idx(['era']);
  const iTop = idx(['age_top', 'agetop', 'top']);
  const iBase = idx(['age_base', 'agebase', 'base']);
  const iThick = idx(['thick']);
  const iColor = idx(['color']);
  const iCol = idx(['column']);
  if (iTop < 0 || iBase < 0) throw new Error('CSV must include age top and base columns.');
  const byCol = new Map<string, StratigraphyUnit[]>();
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    const colName = iCol >= 0 ? cols[iCol] || 'Composite' : 'Composite';
    const unit = parseUnit(
      {
        name: cols[iName],
        lithology: iLith >= 0 ? cols[iLith] : '',
        period: iPeriod >= 0 ? cols[iPeriod] : '',
        era: iEra >= 0 ? cols[iEra] : '',
        ageTop: cols[iTop],
        ageBase: cols[iBase],
        thickness: iThick >= 0 ? cols[iThick] : '',
        color: iColor >= 0 ? cols[iColor] : ''
      },
      (byCol.get(colName)?.length ?? 0)
    );
    byCol.set(colName, [...(byCol.get(colName) ?? []), unit]);
  }
  const columns = [...byCol.entries()].map(([name, units], i) => ({ id: `C${i + 1}`, name, units }));
  return finalize('CSV stratigraphy', '', 'm', 'Ma', 'csv', columns, []);
}

function parseStrText(text: string): ParsedStratigraphy {
  let name = 'Stratigraphy';
  let region = '';
  let unit = 'm';
  let timeUnit = 'Ma';
  let currentCol = 'Composite';
  const byCol = new Map<string, StratigraphyUnit[]>();
  const markers: StratigraphyMarker[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const key = parts[0].toUpperCase();
    if (key === 'NAME') name = parts.slice(1).join(' ') || name;
    else if (key === 'REGION' || key === 'AREA') region = parts.slice(1).join(' ') || region;
    else if (key === 'UNIT' && parts.length === 2 && !/^\d/.test(parts[1])) unit = parts[1];
    else if (key === 'TIME' || key === 'TIMEUNIT') timeUnit = parts[1] || timeUnit;
    else if (key === 'COLUMN') {
      currentCol = parts.slice(1).join(' ').replace(/_/g, ' ') || currentCol;
      if (!byCol.has(currentCol)) byCol.set(currentCol, []);
    } else if (key === 'UNIT' && parts.length >= 6) {
      const list = byCol.get(currentCol) ?? [];
      list.push(
        parseUnit(
          {
            name: parts[1].replace(/_/g, ' '),
            lithology: parts[2].replace(/_/g, ' '),
            period: parts[3].replace(/_/g, ' '),
            ageTop: parts[4],
            ageBase: parts[5],
            thickness: parts[6],
            color: parts[7] || ''
          },
          list.length
        )
      );
      byCol.set(currentCol, list);
    } else if (key === 'MARKER' && parts.length >= 3) {
      markers.push({ id: `M${markers.length + 1}`, name: parts[1].replace(/_/g, ' '), age: asNumber(parts[2]), kind: parts[3] || 'boundary' });
    }
  }
  const columns = [...byCol.entries()].map(([colName, units], i) => ({ id: `C${i + 1}`, name: colName, units }));
  return finalize(name, region, unit, timeUnit, 'str', columns, markers);
}

export function parseStratigraphyText(text: string): ParsedStratigraphy {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('File is empty');
  if (raw.startsWith('{')) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error('Invalid JSON stratigraphy file.');
    }
    if (!json || typeof json !== 'object') throw new Error('JSON stratigraphy must be an object.');
    return parseJsonStrat(json as Record<string, unknown>);
  }
  if (/^\s*#?\s*STRATIGRAPHY/i.test(raw) || (/^\s*NAME\s+/im.test(raw) && /^\s*(UNIT|COLUMN)\s+/im.test(raw))) {
    return parseStrText(raw);
  }
  const header = raw.split('\n')[0] || '';
  if (/[,;\t]/.test(header) && /unit|name|age|period|lith/i.test(header)) {
    return parseCsvStrat(raw);
  }
  throw new Error('Unrecognized stratigraphy file — use JSON, CSV, or .str text.');
}
