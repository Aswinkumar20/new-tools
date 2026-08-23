import type { GeoJSON as LeafletGeoJson, Layer, Map as LeafletMap, PathOptions } from 'leaflet';
import {
  VECTOR_TILE_LAYER_COLORS,
  VECTOR_TILE_MAX_FILE_BYTES,
  VECTOR_TILE_SAMPLE_BASE64,
  VECTOR_TILE_SAMPLE_X,
  VECTOR_TILE_SAMPLE_Y,
  VECTOR_TILE_SAMPLE_Z,
  VECTOR_TILE_SUPPORTED_EXTENSIONS
} from '../constants/vector-tile-viewer.constants';
import type {
  VectorTileFeatureSummary,
  VectorTileLayerInfo,
  VectorTileLoadedFile,
  VectorTileMetadataRow,
  VectorTileStats,
  VectorTileStyleOptions
} from '../types/vector-tile-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';
import { downloadBinaryFile } from './sqljs-db.utils';
import {
  decodeMvtTile,
  tileBoundsLonLat,
  tileToGeoJson,
  type MvtGeoJsonFeature,
  type MvtGeoJsonFeatureCollection,
  type MvtTile
} from './mvt-decode.utils';

export {
  configureLeafletDefaultIcons,
  downloadBinaryFile,
  downloadTextFile,
  loadLeaflet
};

type LeafletModule = typeof import('leaflet');

export function ensureVectorTileStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'vectorTileCss');
}

export function getVectorTileFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isGeoJsonExtension(ext: string): boolean {
  return ext === '.geojson' || ext === '.json';
}

export function isMvtExtension(ext: string): boolean {
  return ext === '.mvt' || ext === '.pbf';
}

export function formatVectorTileFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateVectorTileFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > VECTOR_TILE_MAX_FILE_BYTES) {
    return `File is too large (max ${formatVectorTileFileSize(VECTOR_TILE_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidVectorTileFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of Array.from(files)) {
    const ext = getVectorTileFileExtension(file.name);
    if (!VECTOR_TILE_SUPPORTED_EXTENSIONS.includes(ext)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .mvt, .pbf, or .geojson)'
      });
      continue;
    }
    const sizeError = validateVectorTileFileSize(file);
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

export function createSampleVectorTileFile(): File {
  const bytes = base64ToUint8Array(VECTOR_TILE_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-landuse.mvt', {
    type: 'application/vnd.mapbox-vector-tile',
    lastModified: 0
  });
}

export async function readVectorTileFileBytes(file: File): Promise<Uint8Array> {
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
      reject(new Error('Failed to read vector tile file'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read vector tile file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function readVectorTileFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  const bytes = await readVectorTileFileBytes(file);
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]);
  }
  return s;
}

export function parseTileCoords(
  zRaw: string | number,
  xRaw: string | number,
  yRaw: string | number
): { z: number; x: number; y: number; missing: boolean } {
  const zBlank = zRaw === '' || zRaw == null;
  const xBlank = xRaw === '' || xRaw == null;
  const yBlank = yRaw === '' || yRaw == null;
  if (zBlank || xBlank || yBlank) {
    return { z: 0, x: 0, y: 0, missing: true };
  }
  const z = Number(zRaw);
  const x = Number(xRaw);
  const y = Number(yRaw);
  const missing =
    !Number.isFinite(z) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    z < 0 ||
    x < 0 ||
    y < 0;
  if (missing) {
    return { z: 0, x: 0, y: 0, missing: true };
  }
  return { z: Math.floor(z), x: Math.floor(x), y: Math.floor(y), missing: false };
}

export function buildLayerInfos(tile: MvtTile): VectorTileLayerInfo[] {
  return tile.layers.map((layer, index) => ({
    name: layer.name || `layer-${index}`,
    featureCount: layer.features.length,
    extent: layer.extent || 4096,
    visible: true,
    color: VECTOR_TILE_LAYER_COLORS[index % VECTOR_TILE_LAYER_COLORS.length]
  }));
}

export function buildVectorTileWarnings(
  tile: MvtTile | null,
  geojson: MvtGeoJsonFeatureCollection,
  coordsMissing: boolean,
  sourceKind: VectorTileStats['sourceKind'],
  corsNote?: string | null
): string[] {
  const warnings: string[] = [];
  if (coordsMissing && sourceKind === 'mvt') {
    warnings.push('Tile z/x/y not set — using 0/0/0 for geographic placement.');
  }
  if (corsNote) {
    warnings.push(corsNote);
  }
  if (tile && tile.layers.length === 0) {
    warnings.push('Empty tile — no layers found.');
  }
  if (geojson.features.length === 0) {
    warnings.push('No features to display after decode.');
  }
  return warnings;
}

export function buildVectorTileStats(
  fileName: string,
  layers: VectorTileLayerInfo[],
  geojson: MvtGeoJsonFeatureCollection,
  z: number,
  x: number,
  y: number,
  sourceKind: VectorTileStats['sourceKind'],
  extent: number
): VectorTileStats {
  const bounds = sourceKind === 'geojson' ? null : tileBoundsLonLat(z, x, y);
  return {
    title: fileName.replace(/\.(mvt|pbf|geojson|json)$/i, '') || 'Vector tile',
    layerCount: layers.length,
    featureCount: geojson.features.length,
    extent,
    z,
    x,
    y,
    bounds,
    sourceKind
  };
}

export function geoJsonFromText(text: string): MvtGeoJsonFeatureCollection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid GeoJSON JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('GeoJSON must be an object');
  }
  const obj = parsed as Record<string, unknown>;
  if (obj['type'] === 'FeatureCollection' && Array.isArray(obj['features'])) {
    return parsed as MvtGeoJsonFeatureCollection;
  }
  if (obj['type'] === 'Feature') {
    return { type: 'FeatureCollection', features: [parsed as MvtGeoJsonFeature] };
  }
  if (typeof obj['type'] === 'string' && 'coordinates' in obj) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { layer: 'geojson' },
          geometry: parsed as MvtGeoJsonFeature['geometry']
        }
      ]
    };
  }
  throw new Error('Unsupported GeoJSON type');
}

export function layersFromGeoJson(fc: MvtGeoJsonFeatureCollection): VectorTileLayerInfo[] {
  const counts = new Map<string, number>();
  for (const f of fc.features) {
    const layer =
      f.properties && typeof f.properties['layer'] === 'string'
        ? String(f.properties['layer'])
        : 'geojson';
    counts.set(layer, (counts.get(layer) ?? 0) + 1);
  }
  if (counts.size === 0) {
    return [
      {
        name: 'geojson',
        featureCount: 0,
        extent: 4096,
        visible: true,
        color: VECTOR_TILE_LAYER_COLORS[0]
      }
    ];
  }
  return Array.from(counts.entries()).map(([name, count], index) => ({
    name,
    featureCount: count,
    extent: 4096,
    visible: true,
    color: VECTOR_TILE_LAYER_COLORS[index % VECTOR_TILE_LAYER_COLORS.length]
  }));
}

export function openAndParseMvtBytes(
  bytes: Uint8Array,
  fileName: string,
  z: number,
  x: number,
  y: number,
  coordsMissing: boolean
): {
  tile: MvtTile;
  geojson: MvtGeoJsonFeatureCollection;
  layers: VectorTileLayerInfo[];
  stats: VectorTileStats;
  warnings: string[];
} {
  let tile: MvtTile;
  try {
    tile = decodeMvtTile(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'decode failed';
    throw new Error(`MVT decode error: ${message}`);
  }
  const geojson = tileToGeoJson(tile, z, x, y);
  const layers = buildLayerInfos(tile);
  const extent = layers[0]?.extent ?? 4096;
  const stats = buildVectorTileStats(fileName, layers, geojson, z, x, y, 'mvt', extent);
  const warnings = buildVectorTileWarnings(tile, geojson, coordsMissing, 'mvt');
  return { tile, geojson, layers, stats, warnings };
}

export function openAndParseGeoJsonText(
  text: string,
  fileName: string
): {
  tile: null;
  geojson: MvtGeoJsonFeatureCollection;
  layers: VectorTileLayerInfo[];
  stats: VectorTileStats;
  warnings: string[];
} {
  const geojson = geoJsonFromText(text);
  const layers = layersFromGeoJson(geojson);
  const stats = buildVectorTileStats(fileName, layers, geojson, 0, 0, 0, 'geojson', 4096);
  const warnings = buildVectorTileWarnings(null, geojson, false, 'geojson');
  return { tile: null, geojson, layers, stats, warnings };
}

export function createVectorTileFileRecord(
  file: File,
  bytes: Uint8Array | null,
  tile: MvtTile | null,
  geojson: MvtGeoJsonFeatureCollection,
  layers: VectorTileLayerInfo[],
  stats: VectorTileStats,
  warnings: string[],
  z: number,
  x: number,
  y: number
): VectorTileLoadedFile {
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    name: file.name,
    size: file.size,
    bytes,
    tile,
    geojson,
    layers,
    stats,
    warnings,
    z,
    x,
    y
  };
}

export async function fetchTileFromTemplate(
  template: string,
  z: number,
  x: number,
  y: number
): Promise<{ bytes: Uint8Array; corsWarning: string | null }> {
  const trimmed = template.trim();
  if (!trimmed) {
    throw new Error('Tile URL template is empty');
  }
  if (!/\{z\}/i.test(trimmed) || !/\{x\}/i.test(trimmed) || !/\{y\}/i.test(trimmed)) {
    throw new Error('URL template must include {z}, {x}, and {y}');
  }
  const url = trimmed
    .replace(/\{z\}/gi, String(z))
    .replace(/\{x\}/gi, String(x))
    .replace(/\{y\}/gi, String(y));
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching tile`);
    }
    const buffer = await response.arrayBuffer();
    return { bytes: new Uint8Array(buffer), corsWarning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch failed';
    if (/Failed to fetch|NetworkError|CORS|blocked/i.test(message)) {
      throw new Error(
        `Could not fetch tile (often CORS). Try uploading the .mvt locally. Detail: ${message}`
      );
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export function summarizeFeatures(
  geojson: MvtGeoJsonFeatureCollection
): VectorTileFeatureSummary[] {
  return geojson.features.map((feature, featureIndex) => {
    const layer =
      feature.properties && typeof feature.properties['layer'] === 'string'
        ? String(feature.properties['layer'])
        : 'default';
    const id = feature.id != null ? String(feature.id) : `${layer}-${featureIndex}`;
    return {
      id,
      layer,
      geometryType: feature.geometry.type,
      properties: feature.properties ?? {},
      featureIndex
    };
  });
}

export function filterGeoJsonByVisibleLayers(
  geojson: MvtGeoJsonFeatureCollection,
  layers: VectorTileLayerInfo[]
): MvtGeoJsonFeatureCollection {
  const visible = new Set(layers.filter((l) => l.visible).map((l) => l.name));
  return {
    type: 'FeatureCollection',
    features: geojson.features.filter((f) => {
      const layer =
        f.properties && typeof f.properties['layer'] === 'string'
          ? String(f.properties['layer'])
          : layers[0]?.name ?? 'geojson';
      return visible.has(layer);
    })
  };
}

export function colorForLayer(layerName: string, layers: VectorTileLayerInfo[]): string {
  const found = layers.find((l) => l.name === layerName);
  return found?.color ?? VECTOR_TILE_LAYER_COLORS[0];
}

export function metadataRows(file: VectorTileLoadedFile): VectorTileMetadataRow[] {
  const rows: VectorTileMetadataRow[] = [
    { key: 'source', value: file.stats.sourceKind },
    { key: 'layers', value: String(file.stats.layerCount) },
    { key: 'features', value: String(file.stats.featureCount) },
    { key: 'extent', value: String(file.stats.extent) },
    { key: 'z / x / y', value: `${file.z} / ${file.x} / ${file.y}` }
  ];
  if (file.stats.bounds) {
    const b = file.stats.bounds;
    rows.push({
      key: 'tileBounds',
      value: `${b.west.toFixed(4)}, ${b.south.toFixed(4)} → ${b.east.toFixed(4)}, ${b.north.toFixed(4)}`
    });
  }
  for (const layer of file.layers) {
    rows.push({
      key: `layer.${layer.name}`,
      value: `${layer.featureCount} features · extent ${layer.extent}`
    });
  }
  return rows;
}

export function formatBounds(bounds: VectorTileStats['bounds']): string {
  if (!bounds) return '—';
  const fmt = (n: number) => n.toFixed(4);
  return `${fmt(bounds.west)}, ${fmt(bounds.south)} → ${fmt(bounds.east)}, ${fmt(bounds.north)}`;
}

export function exportSummaryJson(file: VectorTileLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      stats: file.stats,
      layers: file.layers,
      warnings: file.warnings
    },
    null,
    2
  );
}

export function exportAttributesCsv(file: VectorTileLoadedFile): string {
  const summaries = summarizeFeatures(file.geojson);
  const keys = new Set<string>();
  for (const s of summaries) {
    for (const k of Object.keys(s.properties)) {
      keys.add(k);
    }
  }
  const columns = ['id', 'layer', 'geometry', ...Array.from(keys).sort()];
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [columns.join(',')];
  for (const s of summaries) {
    const row = columns.map((col) => {
      if (col === 'id') return escape(s.id);
      if (col === 'layer') return escape(s.layer);
      if (col === 'geometry') return escape(s.geometryType);
      return escape(s.properties[col]);
    });
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

export function exportGeoJson(file: VectorTileLoadedFile): string {
  return JSON.stringify(file.geojson, null, 2);
}

export function canExportVectorTile(file: VectorTileLoadedFile | null): boolean {
  return !!file;
}

export function resolveVectorTileSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  featureCount: number;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'vector-tile-error',
      title: 'Try a sample tile',
      reason: 'Upload a .mvt / .pbf tile, or load the embedded Park sample.',
      actionLabel: 'Open GeoJSON Viewer',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'vector-tile-intro',
      title: 'Inspect vector tiles',
      reason: 'Decode MVT layers, toggle visibility, and export GeoJSON attributes.',
      actionLabel: 'Related: MBTiles',
      path: '/gis-viewers/mbtiles-viewer'
    };
  }
  if (state.featureCount === 0) {
    return {
      id: 'vector-tile-empty',
      title: 'Empty tile',
      reason: 'This tile has no features. Try another z/x/y or a GeoJSON fallback.',
      actionLabel: 'GeoJSON Viewer',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  return null;
}

export function fitMapToVectorTile(
  map: LeafletMap,
  L: LeafletModule,
  file: VectorTileLoadedFile,
  layer: LeafletGeoJson | null
): void {
  const padding: [number, number] = [32, 32];
  if (layer) {
    try {
      const b = layer.getBounds?.();
      if (b && b.isValid()) {
        map.fitBounds(b, { padding });
        return;
      }
    } catch {
      // fall through
    }
  }
  if (file.stats.bounds) {
    const { west, south, east, north } = file.stats.bounds;
    const bounds = L.latLngBounds(L.latLng(south, west), L.latLng(north, east));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding });
      return;
    }
  }
  map.setView([20, 0], 2);
}

export function createGeoJsonLayer(
  L: LeafletModule,
  map: LeafletMap,
  geojson: MvtGeoJsonFeatureCollection,
  layers: VectorTileLayerInfo[],
  style: VectorTileStyleOptions,
  onFeatureClick: (featureIndex: number) => void,
  existing: LeafletGeoJson | null
): LeafletGeoJson {
  if (existing) {
    map.removeLayer(existing);
  }
  const layer = L.geoJSON(geojson as never, {
    style: (feat) => {
      const props = (feat?.properties ?? {}) as Record<string, unknown>;
      const layerName =
        typeof props['layer'] === 'string' ? props['layer'] : layers[0]?.name ?? 'default';
      const color = colorForLayer(layerName, layers);
      return {
        color,
        weight: style.lineWeight,
        opacity: style.opacity,
        fillColor: color,
        fillOpacity: style.opacity * 0.35
      } as PathOptions;
    },
    pointToLayer: (feat, latlng) => {
      const props = (feat?.properties ?? {}) as Record<string, unknown>;
      const layerName =
        typeof props['layer'] === 'string' ? props['layer'] : layers[0]?.name ?? 'default';
      const color = colorForLayer(layerName, layers);
      return L.circleMarker(latlng, {
        radius: 6,
        color,
        weight: style.lineWeight,
        opacity: style.opacity,
        fillColor: color,
        fillOpacity: style.opacity * 0.7
      });
    },
    onEachFeature: (feat, lyr) => {
      const idx = geojson.features.indexOf(feat as MvtGeoJsonFeature);
      lyr.on('click', () => onFeatureClick(idx >= 0 ? idx : 0));
    }
  });
  layer.addTo(map);
  return layer;
}

export function sampleTileCoords(): { z: number; x: number; y: number } {
  return {
    z: VECTOR_TILE_SAMPLE_Z,
    x: VECTOR_TILE_SAMPLE_X,
    y: VECTOR_TILE_SAMPLE_Y
  };
}

export type { Layer, LeafletGeoJson, LeafletMap };
