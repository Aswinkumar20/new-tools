import {
  KML_MAX_FILE_BYTES,
  KML_SUPPORTED_EXTENSIONS
} from '../constants/kml-viewer.constants';
import type {
  KmlBounds,
  KmlDiagramStats,
  KmlFeature,
  KmlFeatureCollection,
  KmlFeatureFilter,
  KmlFeatureKind,
  KmlFeatureSummary,
  KmlGeometry,
  KmlLoadedFile
} from '../types/kml-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';

export { configureLeafletDefaultIcons, downloadTextFile, loadLeaflet };

const LARGE_FEATURE_THRESHOLD = 500;

export function ensureKmlStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'kmlCss');
}

export function getKmlFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isSupportedKmlFile(file: File): boolean {
  const ext = getKmlFileExtension(file.name);
  if (KML_SUPPORTED_EXTENSIONS.includes(ext)) {
    return true;
  }
  const type = (file.type || '').toLowerCase();
  return (
    type.includes('kml') ||
    type === 'application/vnd.google-earth.kml+xml' ||
    type === 'application/xml' ||
    type === 'text/xml'
  );
}

export function validateKmlFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > KML_MAX_FILE_BYTES) {
    return `File is too large (max ${formatKmlFileSize(KML_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidKmlFiles(files: FileList | File[]): {
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

    if (!isSupportedKmlFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .kml or KML .xml)' });
      continue;
    }
    const sizeError = validateKmlFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function formatKmlFileSize(bytes: number): string {
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

export async function readKmlFileText(file: File): Promise<string> {
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

function localName(node: Element): string {
  return (node.localName || node.nodeName || '').toLowerCase();
}

function childElements(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((child) => localName(child) === name);
}

function firstChild(parent: Element, name: string): Element | null {
  return childElements(parent, name)[0] ?? null;
}

function textOf(parent: Element | null, name: string): string | null {
  if (!parent) {
    return null;
  }
  const node = firstChild(parent, name);
  const value = node?.textContent?.trim();
  return value ? value : null;
}

function looksLikeKml(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  if (!trimmed) {
    return false;
  }
  return /<kml\b/i.test(trimmed.slice(0, 8000));
}

function findKmlRoot(doc: Document): Element | null {
  if (doc.documentElement && localName(doc.documentElement) === 'kml') {
    return doc.documentElement;
  }
  return Array.from(doc.getElementsByTagName('*')).find((el) => localName(el) === 'kml') ?? null;
}

function extractDocumentTitle(root: Element): string {
  const documentEl = firstChild(root, 'document');
  const fromDocument = textOf(documentEl, 'name');
  if (fromDocument) {
    return fromDocument;
  }
  const fromRoot = textOf(root, 'name');
  if (fromRoot) {
    return fromRoot;
  }
  return 'KML dataset';
}

function collectEmptyFolderNames(root: Element): string[] {
  const empty: string[] = [];
  const walk = (el: Element): void => {
    if (localName(el) === 'folder') {
      const hasPlacemark = Array.from(el.getElementsByTagName('*')).some(
        (child) => child !== el && localName(child) === 'placemark'
      );
      if (!hasPlacemark) {
        empty.push(textOf(el, 'name') || 'Unnamed folder');
      }
    }
    for (const child of Array.from(el.children)) {
      walk(child);
    }
  };
  walk(root);
  return empty;
}

function hasStyleDefinitions(root: Element): boolean {
  return Array.from(root.getElementsByTagName('*')).some((el) => {
    const name = localName(el);
    return name === 'style' || name === 'stylemap';
  });
}

/** Soft warnings after a successful parse — shown in the UI, not hard failures. */
export function collectKmlWarnings(
  root: Element,
  featureCount: number
): string[] {
  const warnings: string[] = [];
  if (!hasStyleDefinitions(root)) {
    warnings.push('No Style or StyleMap definitions — features will use default map styling.');
  }
  const emptyFolders = collectEmptyFolderNames(root);
  if (emptyFolders.length > 0) {
    const listed = emptyFolders.slice(0, 3).join(', ');
    const more = emptyFolders.length > 3 ? ` (+${emptyFolders.length - 3} more)` : '';
    warnings.push(`Empty folder(s): ${listed}${more}.`);
  }
  if (featureCount > LARGE_FEATURE_THRESHOLD) {
    warnings.push(
      `Large feature count (${featureCount}) — filtering and search help focus the map.`
    );
  }
  return warnings;
}

export async function parseKmlText(text: string): Promise<{
  data: KmlFeatureCollection;
  documentTitle: string;
  warnings: string[];
}> {
  if (!text || !text.trim()) {
    throw new Error('KML file is empty');
  }
  if (!looksLikeKml(text)) {
    throw new Error('Not a KML document — expected an XML file with a <kml> root element');
  }
  if (typeof DOMParser === 'undefined') {
    throw new Error('XML parser is not available in this environment');
  }

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid KML XML — could not parse the document');
  }

  const root = findKmlRoot(doc);
  if (!root) {
    throw new Error('KML root element <kml> was not found');
  }

  const documentTitle = extractDocumentTitle(root);
  const { kml } = await import('@tmcw/togeojson');
  const converted = kml(doc) as KmlFeatureCollection;
  if (!converted || converted.type !== 'FeatureCollection') {
    throw new Error('KML conversion did not produce a FeatureCollection');
  }

  const features = Array.isArray(converted.features)
    ? converted.features.filter(isFeature)
    : [];
  if (features.length === 0) {
    throw new Error('KML contains no drawable features (Placemarks with geometry)');
  }

  const data: KmlFeatureCollection = {
    ...converted,
    type: 'FeatureCollection',
    features
  };
  const warnings = collectKmlWarnings(root, features.length);
  return { data, documentTitle, warnings };
}

export function createKmlFileRecord(
  file: File,
  text: string,
  data: KmlFeatureCollection,
  documentTitle: string,
  warnings: string[]
): KmlLoadedFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    text,
    data,
    documentTitle,
    warnings
  };
}

function isFeature(value: KmlFeature | null | undefined): value is KmlFeature {
  return !!value && value.type === 'Feature';
}

export function normalizeToFeatures(data: KmlFeatureCollection): KmlFeature[] {
  return Array.isArray(data.features) ? data.features.filter(isFeature) : [];
}

export function geometryKind(type: string): KmlFeatureKind {
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

export function summarizeFeatures(data: KmlFeatureCollection): KmlFeatureSummary[] {
  return normalizeToFeatures(data).map((feature, index) => {
    const geometryType = feature.geometry?.type ?? 'null';
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const name =
      stringProp(properties, 'name') ||
      stringProp(properties, 'title') ||
      stringProp(properties, 'label') ||
      (feature.id != null ? String(feature.id) : `Feature ${index + 1}`);
    const description =
      stringProp(properties, 'description') ||
      stringProp(properties, 'desc') ||
      '';
    const previewKeys = Object.keys(properties).slice(0, 3);
    const preview =
      previewKeys.length === 0
        ? geometryType
        : previewKeys.map((key) => `${key}: ${formatPropertyValue(properties[key])}`).join(' · ');
    return {
      id: feature.id != null ? String(feature.id) : `feature-${index}`,
      index,
      name,
      description,
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

/** KML/GeoJSON properties may hold nested objects, which must not render as [object Object]. */
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
  features: KmlFeatureSummary[]
): Record<KmlFeatureFilter, number> {
  const counts: Record<KmlFeatureFilter, number> = {
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

export function filterKmlFeatures(
  features: KmlFeatureSummary[],
  kind: KmlFeatureFilter,
  query: string
): KmlFeatureSummary[] {
  const q = query.trim().toLowerCase();
  return features.filter((feature) => {
    if (kind !== 'all' && feature.kind !== kind) {
      return false;
    }
    if (!q) {
      return true;
    }
    const haystack =
      `${feature.name} ${feature.description} ${feature.id} ${feature.geometryType} ${feature.preview}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function computeBounds(data: KmlFeatureCollection): KmlBounds | null {
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

  const visitGeometry = (geometry: KmlGeometry | null | undefined): void => {
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

  for (const feature of normalizeToFeatures(data)) {
    visitGeometry(feature.geometry);
  }

  if (!found) {
    return null;
  }
  return { west, south, east, north };
}

export function buildKmlStats(
  data: KmlFeatureCollection,
  features: KmlFeatureSummary[],
  documentTitle: string
): KmlDiagramStats {
  const counts = countFeaturesByKind(features);
  const propertyKeys = new Set<string>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      propertyKeys.add(key);
    }
  }
  return {
    title: documentTitle || 'KML dataset',
    features: counts.all,
    points: counts.point,
    lines: counts.line,
    polygons: counts.polygon,
    other: counts.other,
    propertyKeys: propertyKeys.size,
    bounds: computeBounds(data)
  };
}

export function exportFeaturesCsv(features: KmlFeatureSummary[]): string {
  const keys = new Set<string>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      keys.add(key);
    }
  }
  const propertyColumns = Array.from(keys).slice(0, 40);
  const header = ['id', 'name', 'geometry_type', 'kind', 'description', ...propertyColumns];
  const rows = features.map((feature) => {
    const cells = [
      feature.id,
      feature.name,
      feature.geometryType,
      feature.kind,
      feature.description,
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

export function exportGeoJson(data: KmlFeatureCollection): string {
  return JSON.stringify(data, null, 2);
}

export function exportSummaryJson(
  file: KmlLoadedFile,
  stats: KmlDiagramStats,
  features: KmlFeatureSummary[]
): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size, warnings: file.warnings },
      documentTitle: file.documentTitle,
      stats,
      features: features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        description: feature.description,
        geometryType: feature.geometryType,
        kind: feature.kind,
        properties: feature.properties
      }))
    },
    null,
    2
  );
}

export function resolveKmlSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  featureCount: number;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'kml-fix',
      title: 'Need a valid KML file?',
      reason: 'Upload a Google Earth KML document with a <kml> root and Placemark geometry.',
      actionLabel: 'Related: GeoJSON maps',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'kml-intro',
      title: 'Start with a KML map',
      reason: 'Drop a .kml file or load the sample Bay Area tour to explore placemarks on the map.',
      actionLabel: 'Related: GPX tracks',
      path: '/gis-viewers/gpx-viewer'
    };
  }
  if (state.featureCount > LARGE_FEATURE_THRESHOLD) {
    return {
      id: 'kml-large',
      title: 'Large dataset tip',
      reason: 'Filter by geometry type or search placemark names to focus on features of interest.',
      actionLabel: 'Related: Shapefiles',
      path: '/gis-viewers/shapefile-viewer'
    };
  }
  return null;
}

export function formatBounds(bounds: KmlBounds | null): string {
  if (!bounds) {
    return '—';
  }
  return `${bounds.south.toFixed(4)}, ${bounds.west.toFixed(4)} → ${bounds.north.toFixed(4)}, ${bounds.east.toFixed(4)}`;
}
