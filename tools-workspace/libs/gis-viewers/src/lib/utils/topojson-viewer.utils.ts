import {
  TOPOJSON_MAX_FILE_BYTES,
  TOPOJSON_SUPPORTED_EXTENSIONS
} from '../constants/topojson-viewer.constants';
import type {
  TopoJsonBounds,
  TopoJsonDiagramStats,
  TopoJsonFeature,
  TopoJsonFeatureCollection,
  TopoJsonFeatureFilter,
  TopoJsonFeatureKind,
  TopoJsonFeatureSummary,
  TopoJsonGeometry,
  TopoJsonLoadedFile,
  TopoJsonObjectFilter,
  TopoJsonObjectInfo,
  TopoJsonTopology
} from '../types/topojson-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';

export { configureLeafletDefaultIcons, downloadTextFile, loadLeaflet };

const LARGE_FEATURE_THRESHOLD = 500;

export function ensureTopoJsonStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'topojsonCss');
}

export function getTopoJsonFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isSupportedTopoJsonFile(file: File): boolean {
  const ext = getTopoJsonFileExtension(file.name);
  return TOPOJSON_SUPPORTED_EXTENSIONS.includes(ext);
}

export function validateTopoJsonFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > TOPOJSON_MAX_FILE_BYTES) {
    return `File is too large (max ${formatTopoJsonFileSize(TOPOJSON_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidTopoJsonFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();

  for (const file of Array.from(files)) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'Duplicate file in this selection' });
      continue;
    }
    seen.add(key);

    if (!isSupportedTopoJsonFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .topojson or Topology .json)'
      });
      continue;
    }
    const sizeError = validateTopoJsonFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function formatTopoJsonFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readTopoJsonFileText(file: File): Promise<string> {
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

/** Parse JSON text into a Topology object (does not convert features yet). */
export function parseTopoJsonText(text: string): TopoJsonTopology {
  if (!text || !text.trim()) {
    throw new Error('TopoJSON file is empty');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON — expected a TopoJSON Topology document');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('TopoJSON root must be an object');
  }

  const root = parsed as Record<string, unknown>;
  const type = String(root['type'] ?? '');
  if (type !== 'Topology') {
    throw new Error(
      `Root type "${type || 'unknown'}" is not Topology. Expected a TopoJSON Topology document.`
    );
  }

  if (!root['objects'] || typeof root['objects'] !== 'object' || Array.isArray(root['objects'])) {
    throw new Error('Topology is missing a valid "objects" map');
  }

  if (!Array.isArray(root['arcs'])) {
    throw new Error('Topology is missing a valid "arcs" array');
  }

  return root as TopoJsonTopology;
}

function isFeature(value: TopoJsonFeature | null | undefined): value is TopoJsonFeature {
  return !!value && value.type === 'Feature';
}

function toFeatureCollection(converted: unknown, objectName: string): TopoJsonFeatureCollection {
  if (!converted || typeof converted !== 'object') {
    return { type: 'FeatureCollection', features: [], objectName, name: objectName };
  }

  const root = converted as { type?: string; features?: unknown[] };
  if (root.type === 'FeatureCollection') {
    const features = (Array.isArray(root.features) ? root.features : [])
      .filter((item): item is TopoJsonFeature => isFeature(item as TopoJsonFeature))
      .map((feature) => stampObjectName(feature, objectName));
    return { type: 'FeatureCollection', features, objectName, name: objectName };
  }

  if (root.type === 'Feature' && isFeature(root as TopoJsonFeature)) {
    return {
      type: 'FeatureCollection',
      features: [stampObjectName(root as TopoJsonFeature, objectName)],
      objectName,
      name: objectName
    };
  }

  return { type: 'FeatureCollection', features: [], objectName, name: objectName };
}

function stampObjectName(feature: TopoJsonFeature, objectName: string): TopoJsonFeature {
  return {
    ...feature,
    type: 'Feature',
    objectName,
    properties: feature.properties ?? null,
    geometry: feature.geometry ?? null
  };
}

/** Soft warnings after a successful convert — shown in the UI, not hard failures. */
export function collectTopoJsonWarnings(
  topology: TopoJsonTopology,
  objectInfo: TopoJsonObjectInfo[],
  featureCount: number
): string[] {
  const warnings: string[] = [];

  if (!topology.transform) {
    warnings.push(
      'No transform — arcs use absolute coordinates (common for small demos; quantized TopoJSON usually includes transform).'
    );
  }

  const emptyObjects = objectInfo.filter((item) => item.empty).map((item) => item.name);
  if (emptyObjects.length > 0) {
    const listed = emptyObjects.slice(0, 3).join(', ');
    const more = emptyObjects.length > 3 ? ` (+${emptyObjects.length - 3} more)` : '';
    warnings.push(`Empty object(s): ${listed}${more}.`);
  }

  if (featureCount > LARGE_FEATURE_THRESHOLD) {
    warnings.push(
      `Large feature count (${featureCount}) — filtering by object or geometry type helps focus the map.`
    );
  }

  return warnings;
}

/**
 * Convert every topology.objects entry with topojson-client.feature.
 * Throws if zero drawable features are produced.
 */
export async function convertTopology(topology: TopoJsonTopology): Promise<{
  objectNames: string[];
  objectInfo: TopoJsonObjectInfo[];
  objectCollections: Record<string, TopoJsonFeatureCollection>;
  combined: TopoJsonFeatureCollection;
  warnings: string[];
}> {
  const topojson = await import('topojson-client');
  const objectNames = Object.keys(topology.objects);
  if (objectNames.length === 0) {
    throw new Error('Topology "objects" map is empty');
  }

  const objectCollections: Record<string, TopoJsonFeatureCollection> = {};
  const objectInfo: TopoJsonObjectInfo[] = [];
  const combinedFeatures: TopoJsonFeature[] = [];

  for (const name of objectNames) {
    const object = topology.objects[name];
    let collection: TopoJsonFeatureCollection;
    try {
      const converted = topojson.feature(topology as never, object as never);
      collection = toFeatureCollection(converted, name);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'conversion failed';
      throw new Error(`Could not convert topology object "${name}": ${message}`);
    }
    objectCollections[name] = collection;
    objectInfo.push({
      name,
      featureCount: collection.features.length,
      empty: collection.features.length === 0
    });
    combinedFeatures.push(...collection.features);
  }

  if (combinedFeatures.length === 0) {
    throw new Error('Topology contains no convertible features (all objects are empty)');
  }

  const combined: TopoJsonFeatureCollection = {
    type: 'FeatureCollection',
    features: combinedFeatures,
    name: 'Combined topology objects'
  };
  const warnings = collectTopoJsonWarnings(topology, objectInfo, combinedFeatures.length);

  return { objectNames, objectInfo, objectCollections, combined, warnings };
}

export async function parseAndConvertTopoJson(text: string): Promise<{
  topology: TopoJsonTopology;
  objectNames: string[];
  objectInfo: TopoJsonObjectInfo[];
  objectCollections: Record<string, TopoJsonFeatureCollection>;
  combined: TopoJsonFeatureCollection;
  warnings: string[];
}> {
  const topology = parseTopoJsonText(text);
  const converted = await convertTopology(topology);
  return { topology, ...converted };
}

export function createTopoJsonFileRecord(
  file: File,
  text: string,
  topology: TopoJsonTopology,
  objectNames: string[],
  objectInfo: TopoJsonObjectInfo[],
  objectCollections: Record<string, TopoJsonFeatureCollection>,
  combined: TopoJsonFeatureCollection,
  warnings: string[]
): TopoJsonLoadedFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    text,
    topology,
    objectNames,
    objectInfo,
    objectCollections,
    combined,
    warnings
  };
}

export function featuresForObjectFilter(
  file: TopoJsonLoadedFile,
  objectFilter: TopoJsonObjectFilter
): TopoJsonFeature[] {
  if (objectFilter === 'all') {
    return Array.isArray(file.combined.features) ? file.combined.features.filter(isFeature) : [];
  }
  const collection = file.objectCollections[objectFilter];
  return collection?.features?.filter(isFeature) ?? [];
}

export function normalizeToFeatures(data: TopoJsonFeatureCollection): TopoJsonFeature[] {
  return Array.isArray(data.features) ? data.features.filter(isFeature) : [];
}

export function geometryKind(type: string): TopoJsonFeatureKind {
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

export function summarizeFeatures(features: TopoJsonFeature[]): TopoJsonFeatureSummary[] {
  return features.map((feature, index) => {
    const geometryType = feature.geometry?.type ?? 'null';
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const objectName = feature.objectName || 'unknown';
    const name =
      stringProp(properties, 'name') ||
      stringProp(properties, 'title') ||
      stringProp(properties, 'label') ||
      (feature.id != null ? String(feature.id) : `Feature ${index + 1}`);
    const previewKeys = Object.keys(properties).slice(0, 3);
    const preview =
      previewKeys.length === 0
        ? `${objectName} · ${geometryType}`
        : previewKeys.map((key) => `${key}: ${formatPropertyValue(properties[key])}`).join(' · ');
    const idBase =
      feature.id != null ? String(feature.id) : `${objectName}-feature-${index}`;
    return {
      id: idBase,
      index,
      name,
      objectName,
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

/** TopoJSON/GeoJSON properties may hold nested objects, which must not render as [object Object]. */
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
  features: TopoJsonFeatureSummary[]
): Record<TopoJsonFeatureFilter, number> {
  const counts: Record<TopoJsonFeatureFilter, number> = {
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

export function filterTopoJsonFeatures(
  features: TopoJsonFeatureSummary[],
  kind: TopoJsonFeatureFilter,
  query: string
): TopoJsonFeatureSummary[] {
  const q = query.trim().toLowerCase();
  return features.filter((feature) => {
    if (kind !== 'all' && feature.kind !== kind) {
      return false;
    }
    if (!q) {
      return true;
    }
    const haystack =
      `${feature.name} ${feature.id} ${feature.objectName} ${feature.geometryType} ${feature.preview}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function computeBounds(features: TopoJsonFeature[]): TopoJsonBounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let found = false;

  const visitCoords = (coords: unknown): void => {
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
      visitCoords(item);
    }
  };

  const visitGeometry = (geometry: TopoJsonGeometry | null | undefined): void => {
    if (!geometry) {
      return;
    }
    if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
      for (const child of geometry.geometries) {
        visitGeometry(child);
      }
      return;
    }
    visitCoords(geometry.coordinates);
  };

  for (const feature of features) {
    visitGeometry(feature.geometry);
  }

  if (!found) {
    return null;
  }
  return { west, south, east, north };
}

export function buildTopoJsonStats(
  file: TopoJsonLoadedFile,
  features: TopoJsonFeatureSummary[],
  mapFeatures: TopoJsonFeature[]
): TopoJsonDiagramStats {
  const counts = countFeaturesByKind(features);
  const propertyKeys = new Set<string>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      propertyKeys.add(key);
    }
  }
  const title =
    (typeof file.topology['name'] === 'string' && file.topology['name']) ||
    (typeof file.topology['title'] === 'string' && file.topology['title']) ||
    file.name.replace(/\.(topojson|json)$/i, '') ||
    'TopoJSON dataset';

  const bbox = Array.isArray(file.topology.bbox) ? file.topology.bbox : null;

  return {
    title: String(title),
    objects: file.objectNames.length,
    arcs: Array.isArray(file.topology.arcs) ? file.topology.arcs.length : 0,
    features: counts.all,
    points: counts.point,
    lines: counts.line,
    polygons: counts.polygon,
    other: counts.other,
    propertyKeys: propertyKeys.size,
    bounds: computeBounds(mapFeatures),
    bbox,
    hasTransform: !!file.topology.transform
  };
}

export function exportConvertedGeoJson(
  file: TopoJsonLoadedFile,
  objectFilter: TopoJsonObjectFilter
): string {
  const features = featuresForObjectFilter(file, objectFilter);
  const name =
    objectFilter === 'all'
      ? 'Combined topology objects'
      : objectFilter;
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      name,
      features
    },
    null,
    2
  );
}

export function exportFeaturesCsv(features: TopoJsonFeatureSummary[]): string {
  const keys = new Set<string>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      keys.add(key);
    }
  }
  const propertyColumns = Array.from(keys).slice(0, 40);
  const header = ['id', 'name', 'object', 'geometry_type', 'kind', ...propertyColumns];
  const rows = features.map((feature) => {
    const cells = [
      feature.id,
      feature.name,
      feature.objectName,
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
  file: TopoJsonLoadedFile,
  stats: TopoJsonDiagramStats,
  features: TopoJsonFeatureSummary[]
): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      topology: {
        objects: stats.objects,
        arcs: stats.arcs,
        hasTransform: stats.hasTransform,
        bbox: stats.bbox
      },
      objectInfo: file.objectInfo,
      stats,
      features: features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        objectName: feature.objectName,
        geometryType: feature.geometryType,
        kind: feature.kind,
        properties: feature.properties
      }))
    },
    null,
    2
  );
}

export function resolveTopoJsonSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  featureCount: number;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'topojson-fix',
      title: 'Need a valid TopoJSON file?',
      reason: 'Upload a Topology document (.topojson / .json) with objects and arcs.',
      actionLabel: 'Related: GeoJSON maps',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'topojson-intro',
      title: 'Start with a TopoJSON map',
      reason: 'Drop a .topojson file or load the sample city topology to explore objects and features.',
      actionLabel: 'Related: KML maps',
      path: '/gis-viewers/kml-viewer'
    };
  }
  if (state.featureCount > 500) {
    return {
      id: 'topojson-large',
      title: 'Large dataset tip',
      reason: 'Filter by topology object or geometry type, then search properties to focus the map.',
      actionLabel: 'Related: Shapefiles',
      path: '/gis-viewers/shapefile-viewer'
    };
  }
  return null;
}

export function formatBounds(bounds: TopoJsonBounds | null): string {
  if (!bounds) {
    return '—';
  }
  return `${bounds.south.toFixed(4)}, ${bounds.west.toFixed(4)} → ${bounds.north.toFixed(4)}, ${bounds.east.toFixed(4)}`;
}

export function formatBbox(bbox: number[] | null): string {
  if (!bbox || bbox.length < 4) {
    return '—';
  }
  return bbox
    .slice(0, 4)
    .map((n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(4) : String(n)))
    .join(', ');
}
