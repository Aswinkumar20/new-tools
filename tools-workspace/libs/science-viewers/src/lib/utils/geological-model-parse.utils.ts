import type {
  GeoModelExtent,
  GeoModelFault,
  GeoModelLayer,
  GeoModelWell,
  ParsedGeoModel
} from '../types/geological-model-viewer.types';

const LAYER_COLORS = ['#eab308', '#f59e0b', '#d97706', '#64748b', '#a8a29e', '#78716c', '#0f766e', '#7c3aed'];

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function colorFor(index: number, explicit?: string): string {
  if (explicit && /^#?[0-9a-fA-F]{3,8}$/.test(explicit)) return explicit.startsWith('#') ? explicit : `#${explicit}`;
  return LAYER_COLORS[index % LAYER_COLORS.length];
}

function defaultExtent(layers: GeoModelLayer[], wells: GeoModelWell[], faults: GeoModelFault[]): GeoModelExtent {
  let xmin = 0;
  let xmax = 1000;
  let ymin = 0;
  let ymax = 1000;
  let zmin = 0;
  let zmax = 100;
  if (layers.length) {
    zmin = Math.min(...layers.map((l) => l.top));
    zmax = Math.max(...layers.map((l) => l.base));
  }
  const xs = [
    ...wells.map((w) => w.x),
    ...faults.flatMap((f) => [f.x1, f.x2]),
    ...layers.flatMap((l) => l.polygon.map((p) => p.x))
  ];
  const ys = [...wells.map((w) => w.y), ...layers.flatMap((l) => l.polygon.map((p) => p.y))];
  if (xs.length) {
    xmin = Math.min(...xs);
    xmax = Math.max(...xs);
  }
  if (ys.length) {
    ymin = Math.min(...ys);
    ymax = Math.max(...ys);
  }
  if (xmax === xmin) xmax = xmin + 1000;
  if (ymax === ymin) ymax = ymin + 1000;
  if (zmax === zmin) zmax = zmin + 100;
  return { xmin, xmax, ymin, ymax, zmin, zmax };
}

function parseLayer(raw: Record<string, unknown>, index: number): GeoModelLayer {
  const polygonRaw = Array.isArray(raw['polygon']) ? raw['polygon'] : Array.isArray(raw['coordinates']) ? raw['coordinates'] : [];
  const polygon = polygonRaw
    .map((p) => {
      if (Array.isArray(p) && p.length >= 2) return { x: asNumber(p[0]), y: asNumber(p[1]) };
      if (p && typeof p === 'object') return { x: asNumber((p as { x?: unknown }).x), y: asNumber((p as { y?: unknown }).y) };
      return null;
    })
    .filter((p): p is { x: number; y: number } => !!p);
  const top = asNumber(raw['top'] ?? raw['zTop'] ?? raw['depthTop'], index * 100);
  const base = asNumber(raw['base'] ?? raw['zBase'] ?? raw['depthBase'], top + 80);
  return {
    id: asString(raw['id'], `L${index + 1}`),
    name: asString(raw['name'] ?? raw['layer'], `Layer ${index + 1}`),
    lithology: asString(raw['lithology'] ?? raw['lith'], ''),
    age: asString(raw['age'] ?? raw['period'], ''),
    color: colorFor(index, asString(raw['color'], '')),
    top: Math.min(top, base),
    base: Math.max(top, base),
    foldAmplitude: asNumber(raw['foldAmplitude'] ?? raw['fold'], 0),
    porosity: raw['porosity'] == null || raw['porosity'] === '' ? null : asNumber(raw['porosity'], 0),
    description: asString(raw['description'] ?? raw['desc'], ''),
    polygon
  };
}

function parseFault(raw: Record<string, unknown>, index: number): GeoModelFault {
  return {
    id: asString(raw['id'], `F${index + 1}`),
    name: asString(raw['name'], `Fault ${index + 1}`),
    x1: asNumber(raw['x1'] ?? raw['xStart']),
    z1: asNumber(raw['z1'] ?? raw['zStart']),
    x2: asNumber(raw['x2'] ?? raw['xEnd']),
    z2: asNumber(raw['z2'] ?? raw['zEnd']),
    dip: raw['dip'] == null || raw['dip'] === '' ? null : asNumber(raw['dip'])
  };
}

function parseWell(raw: Record<string, unknown>, index: number): GeoModelWell {
  return {
    id: asString(raw['id'], `W${index + 1}`),
    name: asString(raw['name'], `Well ${index + 1}`),
    x: asNumber(raw['x'] ?? raw['easting']),
    y: asNumber(raw['y'] ?? raw['northing']),
    td: asNumber(raw['td'] ?? raw['depth'] ?? raw['tvd'], 0)
  };
}

function parseGeoJson(json: Record<string, unknown>): ParsedGeoModel {
  const warnings: string[] = [];
  const features = Array.isArray(json['features']) ? json['features'] : [];
  const layers: GeoModelLayer[] = [];
  const wells: GeoModelWell[] = [];
  features.forEach((feat, i) => {
    if (!feat || typeof feat !== 'object') return;
    const f = feat as Record<string, unknown>;
    const props = (f['properties'] && typeof f['properties'] === 'object' ? f['properties'] : {}) as Record<string, unknown>;
    const geom = (f['geometry'] && typeof f['geometry'] === 'object' ? f['geometry'] : {}) as Record<string, unknown>;
    const type = asString(geom['type']).toLowerCase();
    if (type === 'point') {
      const coords = Array.isArray(geom['coordinates']) ? geom['coordinates'] : [];
      wells.push({
        id: asString(props['id'], `W${wells.length + 1}`),
        name: asString(props['name'], `Well ${wells.length + 1}`),
        x: asNumber(coords[0]),
        y: asNumber(coords[1]),
        td: asNumber(props['td'] ?? props['depth'], 0)
      });
      return;
    }
    if (type.includes('polygon')) {
      const rings = Array.isArray(geom['coordinates']) ? geom['coordinates'] : [];
      const ring = Array.isArray(rings[0]) ? rings[0] : rings;
      const polygon = (Array.isArray(ring) ? ring : [])
        .map((c) => (Array.isArray(c) ? { x: asNumber(c[0]), y: asNumber(c[1]) } : null))
        .filter((p): p is { x: number; y: number } => !!p);
      layers.push(
        parseLayer(
          {
            ...props,
            polygon,
            name: props['name'] ?? props['layer'] ?? `Unit ${layers.length + 1}`
          },
          layers.length
        )
      );
      return;
    }
    if (i === 0) warnings.push(`GeoJSON geometry “${type || 'unknown'}” was skipped.`);
  });
  if (!layers.length && !wells.length) throw new Error('GeoJSON did not contain polygon layers or well points.');
  const extent = defaultExtent(layers, wells, []);
  return {
    name: asString(json['name'] ?? (json['properties'] as Record<string, unknown> | undefined)?.['name'], 'GeoJSON model'),
    crs: asString(json['crs'] ?? (json as { crs?: { properties?: { name?: string } } }).crs?.properties?.name, 'EPSG:4326'),
    unit: 'm',
    sourceKind: 'geojson',
    extent,
    layers,
    faults: [],
    wells,
    warnings
  };
}

function parseJsonModel(json: Record<string, unknown>): ParsedGeoModel {
  if (asString(json['type']).toLowerCase() === 'featurecollection') return parseGeoJson(json);
  const warnings: string[] = [];
  const layersRaw = Array.isArray(json['layers']) ? json['layers'] : Array.isArray(json['units']) ? json['units'] : [];
  const faultsRaw = Array.isArray(json['faults']) ? json['faults'] : [];
  const wellsRaw = Array.isArray(json['wells']) ? json['wells'] : Array.isArray(json['boreholes']) ? json['boreholes'] : [];
  const layers = layersRaw
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l, i) => parseLayer(l, i));
  const faults = faultsRaw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f, i) => parseFault(f, i));
  const wells = wellsRaw
    .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object')
    .map((w, i) => parseWell(w, i));
  if (!layers.length) throw new Error('JSON model has no layers.');
  const extRaw = json['extent'] && typeof json['extent'] === 'object' ? (json['extent'] as Record<string, unknown>) : null;
  const extent = extRaw
    ? {
        xmin: asNumber(extRaw['xmin'] ?? extRaw['minX']),
        xmax: asNumber(extRaw['xmax'] ?? extRaw['maxX'], 1000),
        ymin: asNumber(extRaw['ymin'] ?? extRaw['minY']),
        ymax: asNumber(extRaw['ymax'] ?? extRaw['maxY'], 1000),
        zmin: asNumber(extRaw['zmin'] ?? extRaw['minZ']),
        zmax: asNumber(extRaw['zmax'] ?? extRaw['maxZ'], 100)
      }
    : defaultExtent(layers, wells, faults);
  if (!wells.length) warnings.push('No wells in this model.');
  if (!faults.length) warnings.push('No faults in this model.');
  return {
    name: asString(json['name'] ?? json['title'], 'Geological model'),
    crs: asString(json['crs'] ?? json['epsg'], 'local'),
    unit: asString(json['unit'] ?? json['units'], 'm'),
    sourceKind: 'json',
    extent,
    layers,
    faults,
    wells,
    warnings
  };
}

function parseCsvModel(text: string): ParsedGeoModel {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('CSV needs a header and at least one layer row.');
  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const idx = (name: string) => header.findIndex((h) => h === name || h.includes(name));
  const iName = Math.max(idx('layer'), idx('name'), 0);
  const iLith = idx('lith');
  const iAge = idx('age');
  const iTop = Math.max(idx('top'), idx('zmin'), idx('from'));
  const iBase = Math.max(idx('base'), idx('zmax'), idx('to'), idx('bottom'));
  const iColor = idx('color');
  const iPor = idx('por');
  if (iTop < 0 || iBase < 0) throw new Error('CSV must include top and base depth columns.');
  const layers: GeoModelLayer[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;
    layers.push(
      parseLayer(
        {
          name: cols[iName],
          lithology: iLith >= 0 ? cols[iLith] : '',
          age: iAge >= 0 ? cols[iAge] : '',
          top: cols[iTop],
          base: cols[iBase],
          color: iColor >= 0 ? cols[iColor] : '',
          porosity: iPor >= 0 ? cols[iPor] : ''
        },
        layers.length
      )
    );
  }
  if (!layers.length) throw new Error('No CSV layer rows parsed.');
  return {
    name: 'CSV geological column',
    crs: 'local',
    unit: 'm',
    sourceKind: 'csv',
    extent: defaultExtent(layers, [], []),
    layers,
    faults: [],
    wells: [],
    warnings: ['CSV import is a stratigraphic column — map polygons and faults are empty.']
  };
}

function parseGmodText(text: string): ParsedGeoModel {
  const warnings: string[] = [];
  let name = 'GEOMODEL';
  let crs = 'local';
  let unit = 'm';
  let extent: GeoModelExtent | null = null;
  const layers: GeoModelLayer[] = [];
  const faults: GeoModelFault[] = [];
  const wells: GeoModelWell[] = [];
  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const key = parts[0].toUpperCase();
    if (key === 'NAME') name = parts.slice(1).join(' ') || name;
    else if (key === 'CRS') crs = parts.slice(1).join(' ') || crs;
    else if (key === 'UNIT') unit = parts[1] || unit;
    else if (key === 'EXTENT' && parts.length >= 7) {
      extent = {
        xmin: asNumber(parts[1]),
        xmax: asNumber(parts[2]),
        ymin: asNumber(parts[3]),
        ymax: asNumber(parts[4]),
        zmin: asNumber(parts[5]),
        zmax: asNumber(parts[6])
      };
    } else if (key === 'LAYER' && parts.length >= 6) {
      layers.push(
        parseLayer(
          {
            name: parts[1].replace(/_/g, ' '),
            lithology: parts[2].replace(/_/g, ' '),
            age: parts[3].replace(/_/g, ' '),
            top: parts[4],
            base: parts[5],
            color: parts[6] || ''
          },
          layers.length
        )
      );
    } else if (key === 'FAULT' && parts.length >= 5) {
      faults.push(
        parseFault(
          { name: parts[1].replace(/_/g, ' '), x1: parts[2], z1: parts[3], x2: parts[4], z2: parts[5] },
          faults.length
        )
      );
    } else if (key === 'WELL' && parts.length >= 4) {
      wells.push(
        parseWell(
          { name: parts[1].replace(/_/g, ' '), x: parts[2], y: parts[3], td: parts[4] },
          wells.length
        )
      );
    }
  }
  if (!layers.length) throw new Error('GEOMODEL text has no LAYER rows.');
  return {
    name,
    crs,
    unit,
    sourceKind: 'gmod',
    extent: extent ?? defaultExtent(layers, wells, faults),
    layers,
    faults,
    wells,
    warnings
  };
}

export function parseGeologicalModelText(text: string): ParsedGeoModel {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('File is empty');
  if (raw.startsWith('{')) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error('Invalid JSON geological model.');
    }
    if (!json || typeof json !== 'object') throw new Error('JSON model must be an object.');
    return parseJsonModel(json as Record<string, unknown>);
  }
  if (/^\s*#?\s*GEOMODEL/i.test(raw) || (/^\s*NAME\s+/im.test(raw) && /^\s*LAYER\s+/im.test(raw))) {
    return parseGmodText(raw);
  }
  if (/[,;\t]/.test(raw.split('\n')[0] || '') && /top|base|layer|name/i.test(raw.split('\n')[0] || '')) {
    return parseCsvModel(raw);
  }
  throw new Error('Unrecognized geological model — use JSON, GeoJSON, .gmod, or CSV with top/base columns.');
}
