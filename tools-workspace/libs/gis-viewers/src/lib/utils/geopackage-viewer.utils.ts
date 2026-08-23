import {
  GEOPACKAGE_ATTR_TABLE_MAX_COLUMNS,
  GEOPACKAGE_ATTR_TABLE_MAX_ROWS,
  GEOPACKAGE_FEATURE_CAP,
  GEOPACKAGE_MAX_FILE_BYTES,
  GEOPACKAGE_SAMPLE_BASE64,
  GEOPACKAGE_SUPPORTED_EXTENSIONS
} from '../constants/geopackage-viewer.constants';
import type {
  GeoPackageAttributeTable,
  GeoPackageBounds,
  GeoPackageDiagramStats,
  GeoPackageFeature,
  GeoPackageFeatureCollection,
  GeoPackageFeatureFilter,
  GeoPackageFeatureKind,
  GeoPackageFeatureSummary,
  GeoPackageGeometry,
  GeoPackageLayerInfo,
  GeoPackageLoadedFile
} from '../types/geopackage-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';
import {
  closeDatabase,
  downloadBinaryFile,
  openSqliteDatabase,
  queryAll,
  tableExists
} from './sqljs-db.utils';
import type { Database } from 'sql.js';

export {
  configureLeafletDefaultIcons,
  downloadBinaryFile,
  downloadTextFile,
  loadLeaflet
};

const LARGE_FEATURE_THRESHOLD = 500;

export function ensureGeoPackageStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'geopackageCss');
}

export function getGeoPackageFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isSupportedGeoPackageFile(file: File): boolean {
  const ext = getGeoPackageFileExtension(file.name);
  if (GEOPACKAGE_SUPPORTED_EXTENSIONS.includes(ext)) {
    return true;
  }
  const type = (file.type || '').toLowerCase();
  return type === 'application/geopackage+sqlite3';
}

export function validateGeoPackageFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > GEOPACKAGE_MAX_FILE_BYTES) {
    return `File is too large (max ${formatGeoPackageFileSize(GEOPACKAGE_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function formatGeoPackageFileSize(bytes: number): string {
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

export function filterValidGeoPackageFiles(files: FileList | File[]): {
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

    if (!isSupportedGeoPackageFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .gpkg)'
      });
      continue;
    }

    const sizeError = validateGeoPackageFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
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

export function createSampleGeoPackageFile(): File {
  const bytes = base64ToUint8Array(GEOPACKAGE_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-city.gpkg', {
    type: 'application/geopackage+sqlite3',
    lastModified: 0
  });
}

/* -------------------------------------------------------------------------- */
/* GeoPackage binary geometry + WKB                                           */
/* -------------------------------------------------------------------------- */

class BinaryReader {
  private offset = 0;
  private littleEndian = true;

  constructor(private readonly data: Uint8Array) {}

  get remaining(): number {
    return this.data.length - this.offset;
  }

  setEndian(littleEndian: boolean): void {
    this.littleEndian = littleEndian;
  }

  skip(n: number): void {
    this.offset += n;
  }

  readUint8(): number {
    if (this.offset >= this.data.length) {
      throw new Error('Unexpected end of geometry buffer');
    }
    return this.data[this.offset++];
  }

  readInt32(): number {
    const view = this.view(4);
    const value = view.getInt32(0, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readUint32(): number {
    const view = this.view(4);
    const value = view.getUint32(0, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readFloat64(): number {
    const view = this.view(8);
    const value = view.getFloat64(0, this.littleEndian);
    this.offset += 8;
    return value;
  }

  private view(size: number): DataView {
    if (this.offset + size > this.data.length) {
      throw new Error('Unexpected end of geometry buffer');
    }
    return new DataView(this.data.buffer, this.data.byteOffset + this.offset, size);
  }
}

const ENVELOPE_BYTES: Record<number, number> = {
  0: 0,
  1: 32,
  2: 48,
  3: 48,
  4: 64
};

/**
 * Parse a GeoPackageBinary geometry blob into a GeoJSON geometry.
 * Supports WKB Point/LineString/Polygon and Multi* variants (types 1–6).
 */
export function parseGeoPackageGeometry(blob: Uint8Array): GeoJSON.Geometry | null {
  if (!blob || blob.length < 8) {
    return null;
  }
  try {
    const reader = new BinaryReader(blob);
    const magic0 = reader.readUint8();
    const magic1 = reader.readUint8();
    if (magic0 !== 0x47 || magic1 !== 0x50) {
      // Not a GP header — try raw WKB from start
      const raw = new BinaryReader(blob);
      return parseWkbGeometry(raw);
    }
    reader.readUint8(); // version
    const flags = reader.readUint8();
    const littleEndian = (flags & 0x01) === 1;
    const envelopeType = (flags >> 1) & 0x07;
    const empty = ((flags >> 4) & 0x01) === 1;
    reader.setEndian(littleEndian);
    reader.readInt32(); // srs_id
    const envelopeBytes = ENVELOPE_BYTES[envelopeType] ?? 0;
    if (envelopeBytes > 0) {
      reader.skip(envelopeBytes);
    }
    if (empty || reader.remaining < 5) {
      return null;
    }
    return parseWkbGeometry(reader);
  } catch {
    return null;
  }
}

function parseWkbGeometry(reader: BinaryReader): GeoJSON.Geometry | null {
  const byteOrder = reader.readUint8();
  reader.setEndian(byteOrder === 1);
  const rawType = reader.readUint32();
  const wkbType = rawType % 1000;
  const hasZ = (rawType >= 1000 && rawType < 2000) || rawType >= 3000;
  const hasM = (rawType >= 2000 && rawType < 3000) || rawType >= 3000;

  switch (wkbType) {
    case 1:
      return { type: 'Point', coordinates: readPosition(reader, hasZ, hasM) };
    case 2:
      return { type: 'LineString', coordinates: readLine(reader, hasZ, hasM) };
    case 3:
      return { type: 'Polygon', coordinates: readPolygon(reader, hasZ, hasM) };
    case 4:
      return { type: 'MultiPoint', coordinates: readMultiPoint(reader, hasZ, hasM) };
    case 5:
      return {
        type: 'MultiLineString',
        coordinates: readMultiLineString(reader, hasZ, hasM)
      };
    case 6:
      return {
        type: 'MultiPolygon',
        coordinates: readMultiPolygon(reader, hasZ, hasM)
      };
    default:
      return null;
  }
}

function readPosition(
  reader: BinaryReader,
  hasZ: boolean,
  hasM: boolean
): number[] {
  const coords: number[] = [reader.readFloat64(), reader.readFloat64()];
  if (hasZ) {
    coords.push(reader.readFloat64());
  }
  if (hasM) {
    coords.push(reader.readFloat64());
  }
  return coords;
}

function readLine(reader: BinaryReader, hasZ: boolean, hasM: boolean): number[][] {
  const count = reader.readUint32();
  const coords: number[][] = [];
  for (let i = 0; i < count; i++) {
    coords.push(readPosition(reader, hasZ, hasM));
  }
  return coords;
}

function readPolygon(
  reader: BinaryReader,
  hasZ: boolean,
  hasM: boolean
): number[][][] {
  const ringCount = reader.readUint32();
  const rings: number[][][] = [];
  for (let i = 0; i < ringCount; i++) {
    rings.push(readLine(reader, hasZ, hasM));
  }
  return rings;
}

function readEmbeddedPoint(
  reader: BinaryReader,
  parentHasZ: boolean,
  parentHasM: boolean
): number[] {
  const byteOrder = reader.readUint8();
  reader.setEndian(byteOrder === 1);
  const rawType = reader.readUint32();
  const hasZ =
    (rawType >= 1000 && rawType < 2000) || rawType >= 3000 || parentHasZ;
  const hasM =
    (rawType >= 2000 && rawType < 3000) || rawType >= 3000 || parentHasM;
  return readPosition(reader, hasZ, hasM);
}

function readMultiPoint(
  reader: BinaryReader,
  hasZ: boolean,
  hasM: boolean
): number[][] {
  const count = reader.readUint32();
  const coords: number[][] = [];
  for (let i = 0; i < count; i++) {
    coords.push(readEmbeddedPoint(reader, hasZ, hasM));
  }
  return coords;
}

function readMultiLineString(
  reader: BinaryReader,
  hasZ: boolean,
  hasM: boolean
): number[][][] {
  const count = reader.readUint32();
  const lines: number[][][] = [];
  for (let i = 0; i < count; i++) {
    const byteOrder = reader.readUint8();
    reader.setEndian(byteOrder === 1);
    const rawType = reader.readUint32();
    const z = (rawType >= 1000 && rawType < 2000) || rawType >= 3000 || hasZ;
    const m = (rawType >= 2000 && rawType < 3000) || rawType >= 3000 || hasM;
    lines.push(readLine(reader, z, m));
  }
  return lines;
}

function readMultiPolygon(
  reader: BinaryReader,
  hasZ: boolean,
  hasM: boolean
): number[][][][] {
  const count = reader.readUint32();
  const polygons: number[][][][] = [];
  for (let i = 0; i < count; i++) {
    const byteOrder = reader.readUint8();
    reader.setEndian(byteOrder === 1);
    const rawType = reader.readUint32();
    const z = (rawType >= 1000 && rawType < 2000) || rawType >= 3000 || hasZ;
    const m = (rawType >= 2000 && rawType < 3000) || rawType >= 3000 || hasM;
    polygons.push(readPolygon(reader, z, m));
  }
  return polygons;
}

/* -------------------------------------------------------------------------- */
/* GeoPackage SQLite parsing                                                  */
/* -------------------------------------------------------------------------- */

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

export function listGeoPackageLayers(db: Database): {
  featureLayers: GeoPackageLayerInfo[];
  tileLayers: GeoPackageLayerInfo[];
  otherLayers: GeoPackageLayerInfo[];
} {
  if (!tableExists(db, 'gpkg_contents')) {
    throw new Error('Not a GeoPackage — missing gpkg_contents table');
  }

  const contentRows = queryAll(
    db,
    `SELECT table_name, data_type, identifier, description, min_x, min_y, max_x, max_y, srs_id
     FROM gpkg_contents`
  );

  const geomByTable = new Map<string, { column: string; typeName: string }>();
  if (tableExists(db, 'gpkg_geometry_columns')) {
    const geomRows = queryAll(
      db,
      `SELECT table_name, column_name, geometry_type_name FROM gpkg_geometry_columns`
    );
    for (const row of geomRows) {
      const table = String(row['table_name'] ?? '');
      if (!table) {
        continue;
      }
      geomByTable.set(table, {
        column: String(row['column_name'] ?? 'geom'),
        typeName: String(row['geometry_type_name'] ?? 'GEOMETRY')
      });
    }
  }

  const featureLayers: GeoPackageLayerInfo[] = [];
  const tileLayers: GeoPackageLayerInfo[] = [];
  const otherLayers: GeoPackageLayerInfo[] = [];

  for (const row of contentRows) {
    const tableName = String(row['table_name'] ?? '');
    if (!tableName) {
      continue;
    }
    const dataType = String(row['data_type'] ?? '');
    const geom = geomByTable.get(tableName);
    let featureCount = 0;
    if (dataType === 'features' && tableExists(db, tableName)) {
      try {
        const countRows = queryAll(db, `SELECT COUNT(*) AS c FROM ${quoteIdent(tableName)}`);
        featureCount = toNumberOrNull(countRows[0]?.['c']) ?? 0;
      } catch {
        featureCount = 0;
      }
    }

    const info: GeoPackageLayerInfo = {
      tableName,
      dataType,
      identifier: String(row['identifier'] ?? tableName),
      description: String(row['description'] ?? ''),
      srsId: toNumberOrNull(row['srs_id']),
      minX: toNumberOrNull(row['min_x']),
      minY: toNumberOrNull(row['min_y']),
      maxX: toNumberOrNull(row['max_x']),
      maxY: toNumberOrNull(row['max_y']),
      geometryColumn: geom?.column ?? null,
      geometryTypeName: geom?.typeName ?? null,
      featureCount
    };

    if (dataType === 'features') {
      featureLayers.push(info);
    } else if (dataType === 'tiles') {
      tileLayers.push(info);
    } else {
      otherLayers.push(info);
    }
  }

  return { featureLayers, tileLayers, otherLayers };
}

function blobFromValue(value: unknown): Uint8Array | null {
  if (!value) {
    return null;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value as number[]);
  }
  return null;
}

export function loadFeatureLayer(
  db: Database,
  layer: GeoPackageLayerInfo,
  featureCap = GEOPACKAGE_FEATURE_CAP
): {
  features: GeoPackageFeature[];
  totalFeatureCount: number;
  truncated: boolean;
  unparseableGeometryCount: number;
} {
  if (!layer.geometryColumn) {
    throw new Error(`Layer "${layer.tableName}" has no geometry column`);
  }
  if (!tableExists(db, layer.tableName)) {
    throw new Error(`Feature table "${layer.tableName}" is missing`);
  }

  const totalFeatureCount = layer.featureCount;
  const geomCol = layer.geometryColumn;
  const rows = queryAll(
    db,
    `SELECT * FROM ${quoteIdent(layer.tableName)} LIMIT ?`,
    [featureCap]
  );

  const features: GeoPackageFeature[] = [];
  let unparseableGeometryCount = 0;

  rows.forEach((row, index) => {
    const blob = blobFromValue(row[geomCol]);
    let geometry: GeoPackageGeometry | null = null;
    if (blob) {
      geometry = parseGeoPackageGeometry(blob) as GeoPackageGeometry | null;
      if (!geometry) {
        unparseableGeometryCount += 1;
      }
    } else {
      unparseableGeometryCount += 1;
    }

    const properties: Record<string, unknown> = {};
    let id: string | number | undefined;
    for (const [key, value] of Object.entries(row)) {
      if (key === geomCol) {
        continue;
      }
      if (value instanceof Uint8Array) {
        continue;
      }
      properties[key] = value;
      if (
        id === undefined &&
        (key === 'id' || key === 'fid' || key.toLowerCase() === 'id')
      ) {
        if (typeof value === 'number' || typeof value === 'string') {
          id = value;
        }
      }
    }

    features.push({
      type: 'Feature',
      id: id ?? index + 1,
      geometry,
      properties,
      layerName: layer.tableName
    });
  });

  return {
    features,
    totalFeatureCount,
    truncated: totalFeatureCount > featureCap,
    unparseableGeometryCount
  };
}

export function collectGeoPackageWarnings(input: {
  featureLayers: GeoPackageLayerInfo[];
  tileLayers: GeoPackageLayerInfo[];
  totalFeatureCount: number;
  truncated: boolean;
  unparseableGeometryCount: number;
}): string[] {
  const warnings: string[] = [];

  if (input.featureLayers.length === 0) {
    warnings.push('No feature layers found in gpkg_contents (data_type = features).');
  }

  if (input.tileLayers.length > 0) {
    const names = input.tileLayers
      .slice(0, 3)
      .map((layer) => layer.tableName)
      .join(', ');
    const more =
      input.tileLayers.length > 3 ? ` (+${input.tileLayers.length - 3} more)` : '';
    warnings.push(
      `Tile layer(s) present (${names}${more}) — listed in the sidebar but not rendered in v1.`
    );
  }

  if (input.featureLayers.length === 0 && input.tileLayers.length > 0) {
    warnings.push('This package appears to be tile-only; feature map rendering is unavailable.');
  }

  if (input.truncated || input.totalFeatureCount > GEOPACKAGE_FEATURE_CAP) {
    warnings.push(
      `Large feature count (${input.totalFeatureCount}) — showing first ${GEOPACKAGE_FEATURE_CAP} features.`
    );
  } else if (input.totalFeatureCount > LARGE_FEATURE_THRESHOLD) {
    warnings.push(
      `Large feature count (${input.totalFeatureCount}) — filtering by geometry type helps focus the map.`
    );
  }

  if (input.unparseableGeometryCount > 0) {
    warnings.push(
      `${input.unparseableGeometryCount} feature(s) had unparseable or empty geometries.`
    );
  }

  return warnings;
}

export async function parseGeoPackageFile(
  file: File,
  wasmAssetBase: string,
  preferredLayer?: string | null
): Promise<GeoPackageLoadedFile> {
  const buffer = await readFileAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  return parseGeoPackageBytes(bytes, file, wasmAssetBase, preferredLayer);
}

export async function parseGeoPackageBytes(
  bytes: Uint8Array,
  file: Pick<File, 'name' | 'size' | 'lastModified'>,
  wasmAssetBase: string,
  preferredLayer?: string | null
): Promise<GeoPackageLoadedFile> {
  let db: Database | null = null;
  try {
    db = await openSqliteDatabase(wasmAssetBase, bytes);
    const { featureLayers, tileLayers, otherLayers } = listGeoPackageLayers(db);

    const selectedLayerName =
      preferredLayer && featureLayers.some((layer) => layer.tableName === preferredLayer)
        ? preferredLayer
        : featureLayers[0]?.tableName ?? null;

    let features: GeoPackageFeature[] = [];
    let totalFeatureCount = 0;
    let truncated = false;
    let unparseableGeometryCount = 0;
    let srsId: number | null = null;

    if (selectedLayerName) {
      const layer = featureLayers.find((item) => item.tableName === selectedLayerName)!;
      srsId = layer.srsId;
      const loaded = loadFeatureLayer(db, layer);
      features = loaded.features;
      totalFeatureCount = loaded.totalFeatureCount;
      truncated = loaded.truncated;
      unparseableGeometryCount = loaded.unparseableGeometryCount;
    }

    const warnings = collectGeoPackageWarnings({
      featureLayers,
      tileLayers,
      totalFeatureCount,
      truncated,
      unparseableGeometryCount
    });

    const collection: GeoPackageFeatureCollection = {
      type: 'FeatureCollection',
      features,
      name: selectedLayerName ?? file.name,
      layerName: selectedLayerName ?? undefined
    };

    return {
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      bytes,
      featureLayers,
      tileLayers,
      otherLayers,
      selectedLayer: selectedLayerName,
      collection,
      totalFeatureCount,
      truncated,
      unparseableGeometryCount,
      srsId,
      warnings
    };
  } finally {
    closeDatabase(db);
  }
}

export async function switchGeoPackageLayer(
  file: GeoPackageLoadedFile,
  layerName: string,
  wasmAssetBase: string
): Promise<GeoPackageLoadedFile> {
  if (file.selectedLayer === layerName) {
    return file;
  }
  return parseGeoPackageBytes(
    file.bytes,
    { name: file.name, size: file.size, lastModified: 0 },
    wasmAssetBase,
    layerName
  );
}

export function geometryKind(type: string): GeoPackageFeatureKind {
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

function stringProp(properties: Record<string, unknown>, key: string): string {
  const value = properties[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

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

export function summarizeFeatures(features: GeoPackageFeature[]): GeoPackageFeatureSummary[] {
  return features.map((feature, index) => {
    const geometryType = feature.geometry?.type ?? 'null';
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const layerName = feature.layerName || 'unknown';
    const name =
      stringProp(properties, 'name') ||
      stringProp(properties, 'title') ||
      stringProp(properties, 'label') ||
      (feature.id != null ? String(feature.id) : `Feature ${index + 1}`);
    const previewKeys = Object.keys(properties).slice(0, 3);
    const preview =
      previewKeys.length === 0
        ? `${layerName} · ${geometryType}`
        : previewKeys
            .map((key) => `${key}: ${formatPropertyValue(properties[key])}`)
            .join(' · ');
    const idBase =
      feature.id != null ? String(feature.id) : `${layerName}-feature-${index}`;
    return {
      id: idBase,
      index,
      name,
      layerName,
      geometryType,
      kind: geometryKind(geometryType),
      propertyCount: Object.keys(properties).length,
      preview,
      properties
    };
  });
}

export function countFeaturesByKind(
  features: GeoPackageFeatureSummary[]
): Record<GeoPackageFeatureFilter, number> {
  const counts: Record<GeoPackageFeatureFilter, number> = {
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

export function filterGeoPackageFeatures(
  features: GeoPackageFeatureSummary[],
  kind: GeoPackageFeatureFilter,
  query: string
): GeoPackageFeatureSummary[] {
  const q = query.trim().toLowerCase();
  return features.filter((feature) => {
    if (kind !== 'all' && feature.kind !== kind) {
      return false;
    }
    if (!q) {
      return true;
    }
    const haystack =
      `${feature.name} ${feature.id} ${feature.layerName} ${feature.geometryType} ${feature.preview}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function computeBounds(features: GeoPackageFeature[]): GeoPackageBounds | null {
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

  const visitGeometry = (geometry: GeoPackageGeometry | null | undefined): void => {
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

export function buildGeoPackageStats(
  file: GeoPackageLoadedFile,
  features: GeoPackageFeatureSummary[],
  mapFeatures: GeoPackageFeature[]
): GeoPackageDiagramStats {
  const counts = countFeaturesByKind(features);
  const propertyKeys = new Set<string>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      propertyKeys.add(key);
    }
  }
  const title =
    file.featureLayers.find((layer) => layer.tableName === file.selectedLayer)?.identifier ||
    file.name.replace(/\.gpkg$/i, '') ||
    'GeoPackage dataset';

  return {
    title: String(title),
    layers: file.featureLayers.length + file.tileLayers.length + file.otherLayers.length,
    featureLayers: file.featureLayers.length,
    tileLayers: file.tileLayers.length,
    features: counts.all,
    totalFeatures: file.totalFeatureCount,
    truncated: file.truncated,
    points: counts.point,
    lines: counts.line,
    polygons: counts.polygon,
    other: counts.other,
    propertyKeys: propertyKeys.size,
    bounds: computeBounds(mapFeatures),
    srsId: file.srsId,
    selectedLayer: file.selectedLayer
  };
}

export function buildAttributeTable(
  features: GeoPackageFeatureSummary[]
): GeoPackageAttributeTable {
  const keyCounts = new Map<string, number>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
  }
  const columns = Array.from(keyCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, GEOPACKAGE_ATTR_TABLE_MAX_COLUMNS)
    .map(([key]) => key);

  const limited = features.slice(0, GEOPACKAGE_ATTR_TABLE_MAX_ROWS);
  const rows = limited.map((feature) => ({
    featureId: feature.id,
    cells: columns.map((key) => formatPropertyValue(feature.properties[key]))
  }));

  return {
    columns,
    rows,
    truncatedRows: features.length > GEOPACKAGE_ATTR_TABLE_MAX_ROWS,
    totalRows: features.length
  };
}

export function exportLayerGeoJson(file: GeoPackageLoadedFile): string {
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      name: file.selectedLayer || file.name,
      features: file.collection.features
    },
    null,
    2
  );
}

export function exportFeaturesCsv(features: GeoPackageFeatureSummary[]): string {
  const keys = new Set<string>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) {
      keys.add(key);
    }
  }
  const propertyColumns = Array.from(keys).slice(0, 40);
  const header = ['id', 'name', 'layer', 'geometry_type', 'kind', ...propertyColumns];
  const rows = features.map((feature) => {
    const cells = [
      feature.id,
      feature.name,
      feature.layerName,
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
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function exportSummaryJson(
  file: GeoPackageLoadedFile,
  stats: GeoPackageDiagramStats,
  features: GeoPackageFeatureSummary[]
): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      layers: {
        feature: file.featureLayers.map((layer) => ({
          tableName: layer.tableName,
          featureCount: layer.featureCount,
          srsId: layer.srsId,
          geometryType: layer.geometryTypeName
        })),
        tiles: file.tileLayers.map((layer) => layer.tableName),
        other: file.otherLayers.map((layer) => ({
          tableName: layer.tableName,
          dataType: layer.dataType
        }))
      },
      selectedLayer: file.selectedLayer,
      stats,
      features: features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        layerName: feature.layerName,
        geometryType: feature.geometryType,
        kind: feature.kind,
        properties: feature.properties
      }))
    },
    null,
    2
  );
}

export function resolveGeoPackageSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  featureCount: number;
  tileOnly: boolean;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'geopackage-fix',
      title: 'Need a valid GeoPackage?',
      reason: 'Upload a .gpkg SQLite database that includes a gpkg_contents table.',
      actionLabel: 'Related: GeoJSON maps',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'geopackage-intro',
      title: 'Start with a GeoPackage',
      reason: 'Drop a .gpkg file or load the sample city package to explore feature layers.',
      actionLabel: 'Related: Shapefiles',
      path: '/gis-viewers/shapefile-viewer'
    };
  }
  if (state.tileOnly) {
    return {
      id: 'geopackage-tiles',
      title: 'Looking for tile packages?',
      reason: 'This GeoPackage has tile layers only. Try MBTiles Viewer for offline tiles.',
      actionLabel: 'Open MBTiles Viewer',
      path: '/gis-viewers/mbtiles-viewer'
    };
  }
  if (state.featureCount > 500) {
    return {
      id: 'geopackage-large',
      title: 'Large dataset tip',
      reason: 'Filter by geometry type and search attributes to focus the map.',
      actionLabel: 'Related: GeoJSON maps',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  return null;
}

export function formatBounds(bounds: GeoPackageBounds | null): string {
  if (!bounds) {
    return '—';
  }
  return `${bounds.south.toFixed(4)}, ${bounds.west.toFixed(4)} → ${bounds.north.toFixed(4)}, ${bounds.east.toFixed(4)}`;
}

export function formatSrs(srsId: number | null): string {
  if (srsId == null) {
    return '—';
  }
  return srsId === 4326 ? 'EPSG:4326' : `SRS ${srsId}`;
}
