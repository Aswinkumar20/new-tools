import type { Database } from 'sql.js';
import type { Coords, DoneCallback, GridLayer, Map as LeafletMap } from 'leaflet';
import {
  MBTILES_MAX_FILE_BYTES,
  MBTILES_SAMPLE_BASE64,
  MBTILES_SUPPORTED_EXTENSIONS
} from '../constants/mbtiles-viewer.constants';
import type {
  MbtilesBounds,
  MbtilesCenter,
  MbtilesDiagramStats,
  MbtilesLoadedFile,
  MbtilesMetadata,
  MbtilesMetadataRow
} from '../types/mbtiles-viewer.types';
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

export {
  configureLeafletDefaultIcons,
  closeDatabase,
  downloadBinaryFile,
  downloadTextFile,
  loadLeaflet,
  openSqliteDatabase
};

type LeafletModule = typeof import('leaflet');

export function ensureMbtilesStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'mbtilesCss');
}

export function getMbtilesFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isSupportedMbtilesFile(file: File): boolean {
  const ext = getMbtilesFileExtension(file.name);
  if (MBTILES_SUPPORTED_EXTENSIONS.includes(ext)) {
    return true;
  }
  const type = (file.type || '').toLowerCase();
  return (
    type.includes('sqlite') ||
    type === 'application/x-mbtiles' ||
    type === 'application/octet-stream'
  );
}

export function formatMbtilesFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateMbtilesFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > MBTILES_MAX_FILE_BYTES) {
    return `File is too large (max ${formatMbtilesFileSize(MBTILES_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidMbtilesFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of Array.from(files)) {
    const ext = getMbtilesFileExtension(file.name);
    if (!MBTILES_SUPPORTED_EXTENSIONS.includes(ext)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .mbtiles)' });
      continue;
    }
    const sizeError = validateMbtilesFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function base64ToUint8Array(base64: string): Uint8Array {
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

/** Builds a sample .mbtiles File from the embedded base64 (lastModified: 0). */
export function createSampleMbtilesFile(): File {
  const bytes = base64ToUint8Array(MBTILES_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-world.mbtiles', {
    type: 'application/x-sqlite3',
    lastModified: 0
  });
}

export async function readMbtilesFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
        return;
      }
      reject(new Error('Failed to read MBTiles file'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read MBTiles file'));
    reader.readAsArrayBuffer(file);
  });
}

/** TMS tile_row → XYZ y at zoom z. */
export function tmsRowToXyzY(tileRow: number, zoom: number): number {
  return (1 << zoom) - 1 - tileRow;
}

/** XYZ y → TMS tile_row at zoom z. */
export function xyzYToTmsRow(y: number, zoom: number): number {
  return (1 << zoom) - 1 - y;
}

export function isVectorTileFormat(format: string | null | undefined): boolean {
  if (!format) {
    return false;
  }
  const normalized = format.trim().toLowerCase();
  return normalized === 'pbf' || normalized === 'mvt' || normalized === 'mapbox';
}

export function mimeForMbtilesFormat(format: string | null | undefined): string {
  const normalized = (format || 'png').trim().toLowerCase();
  if (normalized === 'jpg' || normalized === 'jpeg') {
    return 'image/jpeg';
  }
  if (normalized === 'webp') {
    return 'image/webp';
  }
  if (normalized === 'png') {
    return 'image/png';
  }
  if (isVectorTileFormat(normalized)) {
    return 'application/x-protobuf';
  }
  return 'image/png';
}

export function parseBoundsValue(value: string | null | undefined): MbtilesBounds | null {
  if (!value?.trim()) {
    return null;
  }
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [west, south, east, north] = parts;
  return { west, south, east, north };
}

export function parseCenterValue(value: string | null | undefined): MbtilesCenter | null {
  if (!value?.trim()) {
    return null;
  }
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    return null;
  }
  return {
    lon: parts[0],
    lat: parts[1],
    zoom: parts.length >= 3 && Number.isFinite(parts[2]) ? parts[2] : null
  };
}

export function parseOptionalInt(value: string | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function parseMbtilesMetadataTable(raw: Record<string, string>): MbtilesMetadata {
  return {
    name: raw['name']?.trim() || null,
    format: raw['format']?.trim() || null,
    bounds: parseBoundsValue(raw['bounds']),
    center: parseCenterValue(raw['center']),
    minzoom: parseOptionalInt(raw['minzoom']),
    maxzoom: parseOptionalInt(raw['maxzoom']),
    description: raw['description']?.trim() || null,
    type: raw['type']?.trim() || null,
    version: raw['version']?.trim() || null,
    attribution: raw['attribution']?.trim() || null,
    raw
  };
}

export function readRawMetadata(db: Database): Record<string, string> {
  const rows = queryAll(db, 'SELECT name AS key, value AS value FROM metadata');
  const raw: Record<string, string> = {};
  for (const row of rows) {
    const key = String(row['key'] ?? '').trim();
    if (!key) {
      continue;
    }
    raw[key] = row['value'] == null ? '' : String(row['value']);
  }
  return raw;
}

export function countTiles(db: Database): number {
  const rows = queryAll(db, 'SELECT COUNT(*) AS c FROM tiles');
  const c = Number(rows[0]?.['c'] ?? 0);
  return Number.isFinite(c) ? c : 0;
}

export function queryTileZoomRange(db: Database): { minZoom: number | null; maxZoom: number | null } {
  const rows = queryAll(db, 'SELECT MIN(zoom_level) AS minz, MAX(zoom_level) AS maxz FROM tiles');
  const minz = rows[0]?.['minz'];
  const maxz = rows[0]?.['maxz'];
  return {
    minZoom: minz == null ? null : Number(minz),
    maxZoom: maxz == null ? null : Number(maxz)
  };
}

export function getTileData(
  db: Database,
  zoom: number,
  tileColumn: number,
  xyzY: number
): Uint8Array | null {
  const tileRow = xyzYToTmsRow(xyzY, zoom);
  const rows = queryAll(
    db,
    `SELECT tile_data AS data FROM tiles
     WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?
     LIMIT 1`,
    [zoom, tileColumn, tileRow]
  );
  const data = rows[0]?.['data'];
  if (data == null) {
    return null;
  }
  if (data instanceof Uint8Array) {
    return data.length ? data : null;
  }
  if (Array.isArray(data)) {
    return data.length ? new Uint8Array(data as number[]) : null;
  }
  return null;
}

export function buildMbtilesWarnings(
  metadata: MbtilesMetadata,
  tileCount: number
): string[] {
  const warnings: string[] = [];
  if (!metadata.bounds) {
    warnings.push('Metadata is missing bounds — map will use center / world view.');
  }
  if (isVectorTileFormat(metadata.format)) {
    warnings.push(
      `Format is “${metadata.format}” (vector tiles). Vector tiles are not rendered as raster images in this viewer.`
    );
  }
  if (tileCount === 0) {
    warnings.push('The tiles table is empty — nothing to show on the map.');
  }
  return warnings;
}

export function buildMbtilesStats(
  metadata: MbtilesMetadata,
  tileCount: number,
  tileZoomRange: { minZoom: number | null; maxZoom: number | null }
): MbtilesDiagramStats {
  const minZoom = metadata.minzoom ?? tileZoomRange.minZoom;
  const maxZoom = metadata.maxzoom ?? tileZoomRange.maxZoom;
  return {
    title: metadata.name || 'MBTiles',
    tileCount,
    minZoom: minZoom != null && Number.isFinite(minZoom) ? minZoom : null,
    maxZoom: maxZoom != null && Number.isFinite(maxZoom) ? maxZoom : null,
    format: metadata.format,
    type: metadata.type,
    version: metadata.version,
    bounds: metadata.bounds,
    center: metadata.center,
    attribution: metadata.attribution,
    description: metadata.description,
    isVectorFormat: isVectorTileFormat(metadata.format)
  };
}

export function createMbtilesFileRecord(
  file: File,
  bytes: Uint8Array,
  metadata: MbtilesMetadata,
  stats: MbtilesDiagramStats,
  warnings: string[]
): MbtilesLoadedFile {
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    name: file.name,
    size: file.size,
    bytes,
    metadata,
    stats,
    warnings
  };
}

export async function openAndParseMbtiles(
  wasmAssetBase: string,
  bytes: Uint8Array
): Promise<{ db: Database; metadata: MbtilesMetadata; stats: MbtilesDiagramStats; warnings: string[] }> {
  const db = await openSqliteDatabase(wasmAssetBase, bytes);
  try {
    if (!tableExists(db, 'metadata')) {
      throw new Error('Invalid MBTiles — missing required “metadata” table');
    }
    if (!tableExists(db, 'tiles')) {
      throw new Error('Invalid MBTiles — missing required “tiles” table');
    }
    const raw = readRawMetadata(db);
    const metadata = parseMbtilesMetadataTable(raw);
    const tileCount = countTiles(db);
    const tileZoomRange = queryTileZoomRange(db);
    const stats = buildMbtilesStats(metadata, tileCount, tileZoomRange);
    const warnings = buildMbtilesWarnings(metadata, tileCount);
    return { db, metadata, stats, warnings };
  } catch (error) {
    closeDatabase(db);
    throw error;
  }
}

export function metadataRows(metadata: MbtilesMetadata): MbtilesMetadataRow[] {
  const preferred = [
    'name',
    'format',
    'type',
    'version',
    'description',
    'attribution',
    'bounds',
    'center',
    'minzoom',
    'maxzoom'
  ];
  const rows: MbtilesMetadataRow[] = [];
  const seen = new Set<string>();
  for (const key of preferred) {
    if (key in metadata.raw) {
      rows.push({ key, value: metadata.raw[key] });
      seen.add(key);
    }
  }
  for (const key of Object.keys(metadata.raw).sort()) {
    if (seen.has(key)) {
      continue;
    }
    rows.push({ key, value: metadata.raw[key] });
  }
  return rows;
}

export function formatBounds(bounds: MbtilesBounds | null): string {
  if (!bounds) {
    return '—';
  }
  const fmt = (n: number) => n.toFixed(4);
  return `${fmt(bounds.west)}, ${fmt(bounds.south)} → ${fmt(bounds.east)}, ${fmt(bounds.north)}`;
}

export function formatZoomRange(minZoom: number | null, maxZoom: number | null): string {
  if (minZoom == null && maxZoom == null) {
    return '—';
  }
  if (minZoom != null && maxZoom != null) {
    return `${minZoom} – ${maxZoom}`;
  }
  return String(minZoom ?? maxZoom);
}

export function exportMetadataJson(file: MbtilesLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      metadata: file.metadata.raw,
      parsed: {
        name: file.metadata.name,
        format: file.metadata.format,
        bounds: file.metadata.bounds,
        center: file.metadata.center,
        minzoom: file.metadata.minzoom,
        maxzoom: file.metadata.maxzoom,
        description: file.metadata.description,
        type: file.metadata.type,
        version: file.metadata.version,
        attribution: file.metadata.attribution
      }
    },
    null,
    2
  );
}

export function exportSummaryJson(file: MbtilesLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      stats: file.stats,
      warnings: file.warnings
    },
    null,
    2
  );
}

export function canExportMbtiles(file: MbtilesLoadedFile | null): boolean {
  return !!file?.bytes?.length;
}

/**
 * Custom Leaflet GridLayer that serves tile images from an open MBTiles SQLite DB.
 * Creates blob URLs per tile and revokes them on load/error to avoid leaks.
 */
export function createMbtilesGridLayer(
  L: LeafletModule,
  db: Database,
  options: {
    minZoom?: number;
    maxZoom?: number;
    attribution?: string;
    format?: string | null;
  } = {}
): GridLayer {
  const mime = mimeForMbtilesFormat(options.format);
  const minZoom = options.minZoom ?? 0;
  const maxZoom = options.maxZoom ?? 22;
  const attribution = options.attribution || 'MBTiles';

  const MbtilesGridLayer = L.GridLayer.extend({
    options: {
      minZoom,
      maxZoom,
      attribution,
      tileSize: 256,
      updateWhenIdle: true,
      keepBuffer: 1
    },
    createTile(coords: Coords, done: DoneCallback): HTMLElement {
      const img = document.createElement('img');
      img.alt = '';
      img.setAttribute('role', 'presentation');
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.display = 'block';

      let url: string | null = null;
      const revoke = (): void => {
        if (url) {
          URL.revokeObjectURL(url);
          url = null;
        }
      };

      try {
        const data = getTileData(db, coords.z, coords.x, coords.y);
        if (!data?.length) {
          done(undefined, img);
          return img;
        }
        const blob = new Blob([data as BlobPart], { type: mime });
        url = URL.createObjectURL(blob);
        img.onload = () => {
          revoke();
          done(undefined, img);
        };
        img.onerror = () => {
          revoke();
          done(new Error('Failed to decode tile image'), img);
        };
        img.src = url;
      } catch (error) {
        revoke();
        done(error instanceof Error ? error : new Error('Tile query failed'), img);
      }
      return img;
    }
  });

  return new MbtilesGridLayer() as GridLayer;
}

export function fitMapToMbtiles(
  map: LeafletMap,
  L: LeafletModule,
  stats: MbtilesDiagramStats
): void {
  const padding: [number, number] = [32, 32];
  if (stats.bounds) {
    const { west, south, east, north } = stats.bounds;
    const bounds = L.latLngBounds(L.latLng(south, west), L.latLng(north, east));
    if (bounds.isValid()) {
      const fitOptions: { padding: [number, number]; maxZoom?: number } = { padding };
      if (stats.maxZoom != null) {
        fitOptions.maxZoom = stats.maxZoom;
      }
      map.fitBounds(bounds, fitOptions);
      return;
    }
  }
  if (stats.center) {
    const zoom =
      stats.center.zoom != null
        ? stats.center.zoom
        : stats.minZoom != null
          ? stats.minZoom
          : 2;
    map.setView([stats.center.lat, stats.center.lon], zoom);
    return;
  }
  map.setView([20, 0], stats.minZoom ?? 2);
}

export function resolveMbtilesSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  tileCount: number;
  isVectorFormat: boolean;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'mbtiles-error',
      title: 'Need a valid MBTiles package?',
      reason: 'Upload a SQLite .mbtiles file with metadata and tiles tables.',
      actionLabel: 'Related: GeoJSON maps',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'mbtiles-intro',
      title: 'Start with an MBTiles map',
      reason: 'Drop a .mbtiles package or load the sample world tiles to preview offline raster tiles.',
      actionLabel: 'Related: TopoJSON',
      path: '/gis-viewers/topojson-viewer'
    };
  }
  if (state.isVectorFormat) {
    return {
      id: 'mbtiles-vector',
      title: 'Vector MBTiles tip',
      reason: 'This package uses PBF/MVT tiles. Try GeoJSON or TopoJSON for vector features you can inspect.',
      actionLabel: 'Open GeoJSON Viewer',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  if (state.tileCount === 0) {
    return {
      id: 'mbtiles-empty',
      title: 'No tiles in this package',
      reason: 'The tiles table is empty. Export a raster MBTiles from Tippecanoe, MapTiler, or QGIS.',
      actionLabel: 'Related: GeoPackage',
      path: '/gis-viewers/geopackage-viewer'
    };
  }
  return null;
}
