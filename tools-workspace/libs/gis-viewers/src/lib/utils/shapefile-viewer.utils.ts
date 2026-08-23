import {
  SHAPEFILE_ATTR_TABLE_MAX_COLUMNS,
  SHAPEFILE_ATTR_TABLE_MAX_ROWS,
  SHAPEFILE_LARGE_FEATURE_WARNING,
  SHAPEFILE_MAX_FILE_BYTES,
  SHAPEFILE_PART_EXTENSIONS,
  SHAPEFILE_SAMPLE_ZIP_BASE64,
  SHAPEFILE_SUPPORTED_EXTENSIONS
} from '../constants/shapefile-viewer.constants';
import type {
  ShapefileAttributeTable,
  ShapefileBounds,
  ShapefileDiagramStats,
  ShapefileFeature,
  ShapefileFeatureCollection,
  ShapefileFeatureFilter,
  ShapefileFeatureKind,
  ShapefileFeatureSummary,
  ShapefileGeometry,
  ShapefileLoadedFile,
  ShapefilePartExt
} from '../types/shapefile-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';

export { configureLeafletDefaultIcons, downloadTextFile, loadLeaflet };

export function ensureShapefileStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'shapefileCss');
}

export function getShapefileFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function getShapefileBaseName(fileName: string): string {
  const ext = getShapefileFileExtension(fileName);
  if (!ext) {
    return fileName.toLowerCase();
  }
  return fileName.slice(0, -ext.length).toLowerCase();
}

export function isSupportedShapefileFile(file: File): boolean {
  const ext = getShapefileFileExtension(file.name);
  if (SHAPEFILE_SUPPORTED_EXTENSIONS.includes(ext)) {
    return true;
  }
  const type = (file.type || '').toLowerCase();
  return type.includes('zip') || type === 'application/x-esri-shape';
}

export function isShapefilePartFile(file: File): boolean {
  return SHAPEFILE_PART_EXTENSIONS.includes(getShapefileFileExtension(file.name));
}

export function isShapefileZipFile(file: File): boolean {
  const ext = getShapefileFileExtension(file.name);
  if (ext === '.zip') {
    return true;
  }
  const type = (file.type || '').toLowerCase();
  return type.includes('zip');
}

export function validateShapefileFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > SHAPEFILE_MAX_FILE_BYTES) {
    return `File is too large (max ${formatShapefileFileSize(SHAPEFILE_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function formatShapefileFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function filterValidShapefileFiles(files: FileList | File[]): {
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

    if (!isSupportedShapefileFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .zip or .shp/.dbf/.shx/.prj/.cpg)'
      });
      continue;
    }

    const sizeError = validateShapefileFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}

export interface ShapefilePartGroup {
  baseName: string;
  files: Partial<Record<ShapefilePartExt, File>>;
}

/** Split validated files into zip archives and basename-grouped sidecars. */
export function partitionShapefileSelection(files: File[]): {
  zips: File[];
  groups: ShapefilePartGroup[];
  orphanErrors: Array<{ name: string; reason: string }>;
} {
  const zips: File[] = [];
  const byBase = new Map<string, Partial<Record<ShapefilePartExt, File>>>();
  const orphanErrors: Array<{ name: string; reason: string }> = [];

  for (const file of files) {
    if (isShapefileZipFile(file)) {
      zips.push(file);
      continue;
    }
    if (!isShapefilePartFile(file)) {
      orphanErrors.push({ name: file.name, reason: 'Unsupported shapefile part' });
      continue;
    }
    const ext = getShapefileFileExtension(file.name).replace(/^\./, '') as ShapefilePartExt;
    const base = getShapefileBaseName(file.name);
    const bucket = byBase.get(base) ?? {};
    bucket[ext] = file;
    byBase.set(base, bucket);
  }

  const groups: ShapefilePartGroup[] = [];
  for (const [baseName, partFiles] of byBase.entries()) {
    if (!partFiles.shp) {
      const names = Object.values(partFiles)
        .filter((f): f is File => !!f)
        .map((f) => f.name)
        .join(', ');
      orphanErrors.push({
        name: names || baseName,
        reason: 'Shapefile parts require a .shp file'
      });
      continue;
    }
    groups.push({ baseName, files: partFiles });
  }

  return { zips, groups, orphanErrors };
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function readFileAsText(file: File): Promise<string> {
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

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob !== 'function') {
    throw new Error('Base64 decode is not available in this environment');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function loadShpjs(): Promise<
  (
    data:
      | ArrayBuffer
      | {
          shp?: ArrayBuffer;
          dbf?: ArrayBuffer;
          prj?: string;
          cpg?: ArrayBuffer | string;
        }
  ) => Promise<unknown>
> {
  const mod = await import('shpjs');
  const named = mod as {
    default?: unknown;
    getShapefile?: unknown;
  };
  const candidate =
    typeof named.default === 'function'
      ? named.default
      : typeof named.getShapefile === 'function'
        ? named.getShapefile
        : mod;
  if (typeof candidate !== 'function') {
    throw new Error('Failed to load shpjs parser');
  }
  return candidate as (
    data:
      | ArrayBuffer
      | {
          shp?: ArrayBuffer;
          dbf?: ArrayBuffer;
          prj?: string;
          cpg?: ArrayBuffer | string;
        }
  ) => Promise<unknown>;
}

async function loadJSZip(): Promise<{
  loadAsync: (data: ArrayBuffer | Uint8Array | Blob) => Promise<{ files: Record<string, unknown> }>;
}> {
  const mod = await import('jszip');
  const named = mod as { default?: unknown };
  const candidate = typeof named.default === 'function' ? named.default : mod;
  if (!candidate || typeof (candidate as { loadAsync?: unknown }).loadAsync !== 'function') {
    throw new Error('Failed to load JSZip');
  }
  return candidate as {
    loadAsync: (data: ArrayBuffer | Uint8Array | Blob) => Promise<{ files: Record<string, unknown> }>;
  };
}

/** Builds a sample shapefile zip Blob (same bytes as the embedded base64 archive). */
export async function createSampleShapefileZip(): Promise<Blob> {
  const bytes = base64ToUint8Array(SHAPEFILE_SAMPLE_ZIP_BASE64);
  return new Blob([bytes as BlobPart], { type: 'application/zip' });
}

export function normalizeShpjsResult(
  result: ShapefileFeatureCollection | ShapefileFeatureCollection[] | null | undefined
): ShapefileFeatureCollection {
  if (!result) {
    throw new Error('Shapefile parse returned no data');
  }

  if (Array.isArray(result)) {
    if (result.length === 0) {
      throw new Error('Shapefile archive contained no layers');
    }
    const features: ShapefileFeature[] = [];
    const names: string[] = [];
    for (const layer of result) {
      if (layer.fileName) {
        names.push(String(layer.fileName));
      }
      if (Array.isArray(layer.features)) {
        for (const feature of layer.features) {
          if (feature && feature.type === 'Feature') {
            features.push(feature);
          }
        }
      }
    }
    return {
      type: 'FeatureCollection',
      features,
      fileName: names.join(', ') || 'shapefile',
      name: names.join(', ') || 'shapefile'
    };
  }

  const features = Array.isArray(result.features)
    ? result.features.filter((f): f is ShapefileFeature => !!f && f.type === 'Feature')
    : [];
  const layerName = String(result.fileName || result.name || 'shapefile');
  return {
    type: 'FeatureCollection',
    features,
    fileName: layerName,
    name: layerName
  };
}

export function collectParseWarnings(options: {
  featureCount: number;
  hadDbf: boolean;
  hadPrj: boolean;
  sourceKind: 'zip' | 'parts';
}): string[] {
  const warnings: string[] = [];
  if (!options.hadDbf) {
    warnings.push('No .dbf found — features have no attribute fields.');
  }
  if (!options.hadPrj) {
    warnings.push('No .prj found — coordinates are shown as stored (often lon/lat WGS84).');
  }
  if (options.featureCount >= SHAPEFILE_LARGE_FEATURE_WARNING) {
    warnings.push(
      `Large feature count (${options.featureCount}). Filtering or exporting a subset may help performance.`
    );
  }
  if (options.sourceKind === 'parts' && options.featureCount === 0) {
    warnings.push('Shapefile parsed with zero features.');
  }
  return warnings;
}

export async function parseShapefileZipBuffer(buffer: ArrayBuffer): Promise<{
  data: ShapefileFeatureCollection;
  warnings: string[];
  hadDbf: boolean;
  hadPrj: boolean;
}> {
  const shp = await loadShpjs();
  const result = await shp(buffer);
  const data = normalizeShpjsResult(result as never);

  // Zip contents are opaque to us after parse; assume attributes/prj when features have props
  // and layer had a name. Soft-detect from features:
  const hadDbf = data.features.some(
    (f) => f.properties && Object.keys(f.properties).length > 0
  );
  // Sample zip includes .prj; we cannot know from GeoJSON alone. Prefer optimistic true for zip
  // when shpjs succeeded — missing prj still works. Use false only when clearly unprojected issues.
  // For zip we check via JSZip listing when possible:
  let hadPrj = true;
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files).map((n) => n.toLowerCase());
    hadPrj = names.some((n) => n.endsWith('.prj'));
    const hadDbfInZip = names.some((n) => n.endsWith('.dbf'));
    const warnings = collectParseWarnings({
      featureCount: data.features.length,
      hadDbf: hadDbfInZip,
      hadPrj,
      sourceKind: 'zip'
    });
    return { data, warnings, hadDbf: hadDbfInZip, hadPrj };
  } catch {
    const warnings = collectParseWarnings({
      featureCount: data.features.length,
      hadDbf,
      hadPrj: true,
      sourceKind: 'zip'
    });
    return { data, warnings, hadDbf, hadPrj: true };
  }
}

export async function parseShapefilePartGroup(group: ShapefilePartGroup): Promise<{
  data: ShapefileFeatureCollection;
  warnings: string[];
  hadDbf: boolean;
  hadPrj: boolean;
  displayName: string;
  totalSize: number;
}> {
  const shpFile = group.files.shp;
  if (!shpFile) {
    throw new Error('Missing .shp file');
  }

  const shpBuffer = await readFileAsArrayBuffer(shpFile);
  const dbfBuffer = group.files.dbf ? await readFileAsArrayBuffer(group.files.dbf) : undefined;
  const prjText = group.files.prj ? await readFileAsText(group.files.prj) : undefined;
  const cpgBuffer = group.files.cpg ? await readFileAsArrayBuffer(group.files.cpg) : undefined;

  const shp = await loadShpjs();
  const result = await shp({
    shp: shpBuffer,
    dbf: dbfBuffer,
    prj: prjText,
    cpg: cpgBuffer
  });
  const data = normalizeShpjsResult(result as never);
  if (!data.fileName) {
    data.fileName = group.baseName;
    data.name = group.baseName;
  }

  const hadDbf = !!group.files.dbf;
  const hadPrj = !!group.files.prj;
  const warnings = collectParseWarnings({
    featureCount: data.features.length,
    hadDbf,
    hadPrj,
    sourceKind: 'parts'
  });

  const totalSize = Object.values(group.files).reduce((sum, f) => sum + (f?.size ?? 0), 0);
  const displayName = `${group.baseName}.shp`;

  return { data, warnings, hadDbf, hadPrj, displayName, totalSize };
}

export function createShapefileFileRecord(options: {
  name: string;
  size: number;
  data: ShapefileFeatureCollection;
  warnings: string[];
  sourceKind: 'zip' | 'parts';
  hadDbf: boolean;
  hadPrj: boolean;
  lastModified?: number;
}): ShapefileLoadedFile {
  const layerName = String(options.data.fileName || options.data.name || options.name);
  const geojsonText = JSON.stringify(
    {
      type: 'FeatureCollection',
      name: layerName,
      features: options.data.features
    },
    null,
    2
  );
  return {
    id: `${options.name}-${options.size}-${options.lastModified ?? 0}`,
    name: options.name,
    size: options.size,
    geojsonText,
    data: options.data,
    warnings: options.warnings,
    sourceKind: options.sourceKind,
    layerName,
    hadDbf: options.hadDbf,
    hadPrj: options.hadPrj
  };
}

export function geometryKind(type: string): ShapefileFeatureKind {
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

/** Shapefile / DBF properties may hold nested objects — never render as [object Object]. */
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

function stringProp(properties: Record<string, unknown>, key: string): string {
  const value = properties[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function summarizeFeatures(data: ShapefileFeatureCollection): ShapefileFeatureSummary[] {
  return data.features.map((feature, index) => {
    const geometryType = feature.geometry?.type ?? 'null';
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const name =
      stringProp(properties, 'name') ||
      stringProp(properties, 'NAME') ||
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

export function countFeaturesByKind(
  features: ShapefileFeatureSummary[]
): Record<ShapefileFeatureFilter, number> {
  const counts: Record<ShapefileFeatureFilter, number> = {
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

export function filterShapefileFeatures(
  features: ShapefileFeatureSummary[],
  kind: ShapefileFeatureFilter,
  query: string
): ShapefileFeatureSummary[] {
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

export function computeBounds(data: ShapefileFeatureCollection): ShapefileBounds | null {
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

  const visitGeometry = (geometry: ShapefileGeometry | null | undefined): void => {
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

  for (const feature of data.features) {
    visitGeometry(feature.geometry);
  }

  if (!found) {
    return null;
  }
  return { west, south, east, north };
}

export function buildShapefileStats(
  file: ShapefileLoadedFile,
  features: ShapefileFeatureSummary[]
): ShapefileDiagramStats {
  const counts = countFeaturesByKind(features);
  const propertyKeys = new Set<string>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      propertyKeys.add(key);
    }
  }
  return {
    title: file.layerName || file.name,
    layerName: file.layerName,
    features: counts.all,
    points: counts.point,
    lines: counts.line,
    polygons: counts.polygon,
    other: counts.other,
    propertyKeys: propertyKeys.size,
    bounds: computeBounds(file.data)
  };
}

export function buildAttributeTable(features: ShapefileFeatureSummary[]): ShapefileAttributeTable {
  const keyCounts = new Map<string, number>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
  }
  const columns = Array.from(keyCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, SHAPEFILE_ATTR_TABLE_MAX_COLUMNS)
    .map(([key]) => key);

  const limited = features.slice(0, SHAPEFILE_ATTR_TABLE_MAX_ROWS);
  const rows = limited.map((feature) => ({
    featureId: feature.id,
    cells: columns.map((key) => formatPropertyValue(feature.properties[key]))
  }));

  return {
    columns,
    rows,
    truncatedRows: features.length > SHAPEFILE_ATTR_TABLE_MAX_ROWS,
    totalRows: features.length
  };
}

export function exportFeaturesCsv(features: ShapefileFeatureSummary[]): string {
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
  file: ShapefileLoadedFile,
  stats: ShapefileDiagramStats,
  features: ShapefileFeatureSummary[]
): string {
  return JSON.stringify(
    {
      file: {
        name: file.name,
        size: file.size,
        layerName: file.layerName,
        sourceKind: file.sourceKind,
        hadDbf: file.hadDbf,
        hadPrj: file.hadPrj
      },
      warnings: file.warnings,
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

export function resolveShapefileSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  featureCount: number;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'shapefile-fix',
      title: 'Need a valid Shapefile?',
      reason: 'Upload a .zip archive or multi-select .shp with .dbf / .shx (optional .prj, .cpg).',
      actionLabel: 'Related: GeoJSON maps',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'shapefile-intro',
      title: 'Start with a Shapefile map',
      reason: 'Drop a .zip shapefile or load the sample city points to explore attributes on the map.',
      actionLabel: 'Related: GPX tracks',
      path: '/gis-viewers/gpx-viewer'
    };
  }
  if (state.featureCount > 500) {
    return {
      id: 'shapefile-large',
      title: 'Large dataset tip',
      reason: 'Filter by geometry type or search attributes to focus on features of interest.',
      actionLabel: 'Related: KML maps',
      path: '/gis-viewers/kml-viewer'
    };
  }
  return null;
}

export function formatBounds(bounds: ShapefileBounds | null): string {
  if (!bounds) {
    return '—';
  }
  return `${bounds.south.toFixed(4)}, ${bounds.west.toFixed(4)} → ${bounds.north.toFixed(4)}, ${bounds.east.toFixed(4)}`;
}
