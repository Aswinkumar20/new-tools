import {
  GEOJSON_MAX_FILE_BYTES,
  GEOJSON_SUPPORTED_EXTENSIONS
} from '../constants/geojson-viewer.constants';
import type {
  GeoJsonBounds,
  GeoJsonDiagramStats,
  GeoJsonFeature,
  GeoJsonFeatureFilter,
  GeoJsonFeatureKind,
  GeoJsonFeatureSummary,
  GeoJsonGeometry,
  GeoJsonLoadedFile,
  GeoJsonRoot
} from '../types/geojson-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';

export { configureLeafletDefaultIcons, downloadTextFile, loadLeaflet };

export function ensureGeoJsonStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'geojsonCss');
}

export function getGeoJsonFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isSupportedGeoJsonFile(file: File): boolean {
  const ext = getGeoJsonFileExtension(file.name);
  return GEOJSON_SUPPORTED_EXTENSIONS.includes(ext);
}

export function validateGeoJsonFileSize(file: File): string | null {
  if (file.size > GEOJSON_MAX_FILE_BYTES) {
    return `File is too large (max ${formatGeoJsonFileSize(GEOJSON_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidGeoJsonFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of Array.from(files)) {
    if (!isSupportedGeoJsonFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .geojson or .json)' });
      continue;
    }
    const sizeError = validateGeoJsonFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function formatGeoJsonFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readGeoJsonFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function parseGeoJsonText(text: string): GeoJsonRoot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON — expected a GeoJSON document');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('GeoJSON root must be an object');
  }
  const root = parsed as GeoJsonRoot;
  const type = String(root.type ?? '');
  const allowed = new Set([
    'FeatureCollection',
    'Feature',
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection'
  ]);
  if (!allowed.has(type)) {
    throw new Error(
      `Root type "${type || 'unknown'}" is not GeoJSON. Expected FeatureCollection, Feature, or Geometry.`
    );
  }
  return root;
}

export function createGeoJsonFileRecord(file: File, text: string, data: GeoJsonRoot): GeoJsonLoadedFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    text,
    data
  };
}

export function normalizeToFeatures(root: GeoJsonRoot): GeoJsonFeature[] {
  if (root.type === 'FeatureCollection') {
    return Array.isArray(root.features) ? root.features.filter(isFeature) : [];
  }
  if (root.type === 'Feature' && isFeature(root as unknown as GeoJsonFeature)) {
    return [root as unknown as GeoJsonFeature];
  }
  return [
    {
      type: 'Feature',
      properties: { name: root.type },
      geometry: root as unknown as GeoJsonGeometry
    }
  ];
}

function isFeature(value: GeoJsonFeature | null | undefined): value is GeoJsonFeature {
  return !!value && value.type === 'Feature';
}

export function geometryKind(type: string): GeoJsonFeatureKind {
  switch (type) {
    case 'Point':
    case 'MultiPoint':
      return 'point';
    case 'LineString':
    case 'MultiLineString':
      return 'line';
    case 'Polygon':
    case 'MultiPolygon':
      return 'polygon';
    default:
      return 'other';
  }
}

export function summarizeFeatures(root: GeoJsonRoot): GeoJsonFeatureSummary[] {
  return normalizeToFeatures(root).map((feature, index) => {
    const geometryType = feature.geometry?.type ?? 'null';
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const name =
      stringProp(properties, 'name') ||
      stringProp(properties, 'title') ||
      stringProp(properties, 'label') ||
      (feature.id != null ? String(feature.id) : `Feature ${index + 1}`);
    const previewKeys = Object.keys(properties).slice(0, 3);
    const preview =
      previewKeys.length === 0
        ? geometryType
        : previewKeys.map((key) => `${key}: ${formatPropertyValue(properties[key])}`).join(' · ');
    return {
      id: feature.id != null ? String(feature.id) : `feature-${index}`,
      index,
      name,
      geometryType,
      kind: geometryKind(geometryType),
      propertyCount: Object.keys(properties).length,
      preview,
      properties
    };
  });
}

function stringProp(properties: Record<string, unknown>, key: string): string {
  const value = properties[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/** GeoJSON properties may hold nested objects, which must not render as [object Object]. */
export function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }
  return String(value);
}

export function countFeaturesByKind(
  features: GeoJsonFeatureSummary[]
): Record<GeoJsonFeatureFilter, number> {
  const counts: Record<GeoJsonFeatureFilter, number> = {
    all: features.length,
    point: 0,
    line: 0,
    polygon: 0,
    other: 0
  };
  for (const feature of features) {
    counts[feature.kind] += 1;
  }
  return counts;
}

export function filterGeoJsonFeatures(
  features: GeoJsonFeatureSummary[],
  kind: GeoJsonFeatureFilter,
  query: string
): GeoJsonFeatureSummary[] {
  const q = query.trim().toLowerCase();
  return features.filter((feature) => {
    if (kind !== 'all' && feature.kind !== kind) {
      return false;
    }
    if (!q) {
      return true;
    }
    const haystack = `${feature.name} ${feature.id} ${feature.geometryType} ${feature.preview}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function computeBounds(root: GeoJsonRoot): GeoJsonBounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let found = false;

  const visitCoords = (coords: unknown, depth: number): void => {
    if (!Array.isArray(coords) || coords.length === 0) {
      return;
    }
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const lng = coords[0] as number;
      const lat = coords[1] as number;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return;
      }
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      found = true;
      return;
    }
    for (const item of coords) {
      visitCoords(item, depth + 1);
    }
  };

  const visitGeometry = (geometry: GeoJsonGeometry | null | undefined): void => {
    if (!geometry) {
      return;
    }
    if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
      for (const child of geometry.geometries) {
        visitGeometry(child);
      }
      return;
    }
    visitCoords(geometry.coordinates, 0);
  };

  for (const feature of normalizeToFeatures(root)) {
    visitGeometry(feature.geometry);
  }

  if (!found) {
    return null;
  }
  return { west, south, east, north };
}

export function buildGeoJsonStats(
  root: GeoJsonRoot,
  features: GeoJsonFeatureSummary[]
): GeoJsonDiagramStats {
  const counts = countFeaturesByKind(features);
  const propertyKeys = new Set<string>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      propertyKeys.add(key);
    }
  }
  const title =
    (typeof root['name'] === 'string' && root['name']) ||
    (typeof root['title'] === 'string' && root['title']) ||
    'GeoJSON dataset';
  return {
    title: String(title),
    features: counts.all,
    points: counts.point,
    lines: counts.line,
    polygons: counts.polygon,
    other: counts.other,
    propertyKeys: propertyKeys.size,
    bounds: computeBounds(root)
  };
}

export function exportFeaturesCsv(features: GeoJsonFeatureSummary[]): string {
  const keys = new Set<string>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      keys.add(key);
    }
  }
  const propertyColumns = Array.from(keys).slice(0, 40);
  const header = ['id', 'name', 'geometry_type', 'kind', ...propertyColumns];
  const rows = features.map((feature) => {
    const cells = [
      feature.id,
      feature.name,
      feature.geometryType,
      feature.kind,
      ...propertyColumns.map((key) => formatPropertyValue(feature.properties[key]))
    ];
    return cells.map(csvEscape).join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportSummaryJson(
  file: GeoJsonLoadedFile,
  stats: GeoJsonDiagramStats,
  features: GeoJsonFeatureSummary[]
): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      stats,
      features: features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        geometryType: feature.geometryType,
        kind: feature.kind,
        properties: feature.properties
      }))
    },
    null,
    2
  );
}

export function resolveGeoJsonSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  featureCount: number;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'geojson-fix',
      title: 'Need a valid GeoJSON file?',
      reason: 'Upload an RFC 7946 FeatureCollection, Feature, or Geometry (.geojson / .json).',
      actionLabel: 'Related: GPX tracks',
      path: '/gis-viewers/gpx-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'geojson-intro',
      title: 'Start with a GeoJSON map',
      reason: 'Drop a .geojson file or load the sample city features to explore the map and attributes.',
      actionLabel: 'Related: KML maps',
      path: '/gis-viewers/kml-viewer'
    };
  }
  if (state.featureCount > 500) {
    return {
      id: 'geojson-large',
      title: 'Large dataset tip',
      reason: 'Filter by geometry type or search properties to focus on features of interest.',
      actionLabel: 'Related: Shapefiles',
      path: '/gis-viewers/shapefile-viewer'
    };
  }
  return null;
}

export function formatBounds(bounds: GeoJsonBounds | null): string {
  if (!bounds) {
    return '—';
  }
  return `${bounds.south.toFixed(4)}, ${bounds.west.toFixed(4)} → ${bounds.north.toFixed(4)}, ${bounds.east.toFixed(4)}`;
}
