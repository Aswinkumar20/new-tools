import {
  GPS_TRACK_DEFAULT_MOVING_THRESHOLD_MPS,
  GPS_TRACK_MAX_FILE_BYTES,
  GPS_TRACK_SAMPLE,
  GPS_TRACK_SUPPORTED_EXTENSIONS
} from '../constants/gps-track-viewer.constants';
import type {
  GpsProfileGeometry,
  GpsProfileSample,
  GpsSpeedSegment,
  GpsTrackChartAxis,
  GpsTrackInfo,
  GpsTrackLoadedFile,
  GpsTrackPoint,
  GpsTrackSourceKind,
  GpsTrackStats
} from '../types/gps-track-viewer.types';
import type { GpxBounds, GpxPoint, GpxUnitSystem } from '../types/gpx-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';
import {
  elevationDelta,
  flattenTrackPoints,
  formatBounds,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  formatSpeed,
  haversineMeters,
  parseGpxText,
  pathDistanceMeters
} from './gpx-viewer.utils';

export {
  configureLeafletDefaultIcons,
  downloadTextFile,
  loadLeaflet,
  formatBounds,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  formatSpeed,
  haversineMeters,
  parseGpxText,
  pathDistanceMeters,
  flattenTrackPoints
};

export function ensureGpsTrackStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'gpsTrackCss');
}

export function getGpsTrackFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function formatGpsTrackFileSize(bytes: number): string {
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

export function validateGpsTrackFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > GPS_TRACK_MAX_FILE_BYTES) {
    return `File is too large (max ${formatGpsTrackFileSize(GPS_TRACK_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function isSupportedGpsTrackFile(file: File): boolean {
  const ext = getGpsTrackFileExtension(file.name);
  if (GPS_TRACK_SUPPORTED_EXTENSIONS.includes(ext)) {
    return true;
  }
  const type = (file.type || '').toLowerCase();
  return (
    type.includes('gpx') ||
    type.includes('csv') ||
    type.includes('geo+json') ||
    type === 'application/json' ||
    type === 'application/xml' ||
    type === 'text/xml' ||
    type === 'text/plain'
  );
}

export function filterValidGpsTrackFiles(files: FileList | File[]): {
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

    if (!isSupportedGpsTrackFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .gpx, .csv/.txt, or .geojson)'
      });
      continue;
    }
    const sizeError = validateGpsTrackFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleGpsTrackFile(): File {
  return new File([GPS_TRACK_SAMPLE], 'harbor-loop-sample.gpx', {
    type: 'application/gpx+xml',
    lastModified: 0
  });
}

export async function readGpsTrackFileText(file: File): Promise<string> {
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

function sourceKindForFile(fileName: string, text: string): GpsTrackSourceKind {
  const ext = getGpsTrackFileExtension(fileName);
  if (ext === '.gpx' || /<gpx\b/i.test(text.slice(0, 8000))) {
    return 'gpx';
  }
  if (ext === '.geojson' || ext === '.json' || /^\s*\{/.test(text)) {
    return 'geojson';
  }
  return 'csv';
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const LAT_HEADERS = new Set(['lat', 'latitude', 'y']);
const LON_HEADERS = new Set(['lon', 'lng', 'long', 'longitude', 'x']);
const ELE_HEADERS = new Set(['ele', 'elev', 'elevation', 'alt', 'altitude', 'height']);
const TIME_HEADERS = new Set(['time', 'timestamp', 'datetime', 'date', 'utc']);

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function parseGpsTrackCsv(text: string): GpsTrackPoint[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV track needs a header row and at least one data row');
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const latIdx = headers.findIndex((h) => LAT_HEADERS.has(h));
  const lonIdx = headers.findIndex((h) => LON_HEADERS.has(h));
  if (latIdx < 0 || lonIdx < 0) {
    throw new Error('CSV must include latitude and longitude columns (e.g. lat, lon)');
  }
  const eleIdx = headers.findIndex((h) => ELE_HEADERS.has(h));
  const timeIdx = headers.findIndex((h) => TIME_HEADERS.has(h));

  const points: GpsTrackPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const lat = Number(cells[latIdx]);
    const lon = Number(cells[lonIdx]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      continue;
    }
    const eleRaw = eleIdx >= 0 ? Number(cells[eleIdx]) : NaN;
    const time = timeIdx >= 0 ? (cells[timeIdx] || '').trim() || null : null;
    points.push({
      lat,
      lon,
      ele: Number.isFinite(eleRaw) ? eleRaw : null,
      time,
      name: null
    });
  }
  if (points.length < 2) {
    throw new Error('CSV track has fewer than 2 valid coordinate rows');
  }
  return points;
}

function elevationFromProps(props: GeoJSON.GeoJsonProperties | null | undefined): number | null {
  if (!props || typeof props !== 'object') {
    return null;
  }
  for (const key of ['ele', 'elev', 'elevation', 'alt', 'altitude']) {
    const raw = (props as Record<string, unknown>)[key];
    if (raw == null || raw === '') continue;
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function timeFromProps(props: GeoJSON.GeoJsonProperties | null | undefined): string | null {
  if (!props || typeof props !== 'object') {
    return null;
  }
  for (const key of ['time', 'timestamp', 'datetime', 'when']) {
    const raw = (props as Record<string, unknown>)[key];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
  }
  return null;
}

export function parseGpsTrackGeoJson(text: string): GpsTrackPoint[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON — could not parse GeoJSON track');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('GeoJSON track must be an object');
  }
  const root = parsed as GeoJSON.GeoJSON;
  let coords: number[][] = [];
  let featureProps: GeoJSON.GeoJsonProperties = null;

  if (root.type === 'Feature' && root.geometry?.type === 'LineString') {
    coords = root.geometry.coordinates as number[][];
    featureProps = root.properties;
  } else if (root.type === 'FeatureCollection') {
    const feature = root.features.find((f) => f.geometry?.type === 'LineString');
    if (!feature || feature.geometry?.type !== 'LineString') {
      throw new Error('GeoJSON must contain a LineString feature');
    }
    coords = feature.geometry.coordinates as number[][];
    featureProps = feature.properties;
  } else if (root.type === 'LineString') {
    coords = root.coordinates as number[][];
  } else {
    throw new Error('Expected a LineString GeoJSON track');
  }

  const times = Array.isArray((featureProps as Record<string, unknown> | null)?.['times'])
    ? ((featureProps as Record<string, unknown>)['times'] as unknown[])
    : null;

  const points: GpsTrackPoint[] = [];
  for (let i = 0; i < coords.length; i++) {
    const lng = coords[i][0];
    const lat = coords[i][1];
    const ele3 = coords[i].length > 2 ? coords[i][2] : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    const time =
      times && typeof times[i] === 'string'
        ? (times[i] as string)
        : i === 0
          ? timeFromProps(featureProps)
          : null;
    points.push({
      lat,
      lon: lng,
      ele: Number.isFinite(ele3) ? ele3 : elevationFromProps(featureProps),
      time,
      name: null
    });
  }
  if (points.length < 2) {
    throw new Error('GeoJSON LineString has fewer than 2 valid points');
  }
  return points;
}

export function enrichTrackPoints(points: GpxPoint[]): GpsTrackPoint[] {
  const enriched: GpsTrackPoint[] = [];
  let distance = 0;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let speedMps: number | null = null;
    if (i > 0) {
      const prev = points[i - 1];
      const segDist = haversineMeters(prev, point);
      distance += segDist;
      if (prev.time && point.time) {
        const dt = (Date.parse(point.time) - Date.parse(prev.time)) / 1000;
        if (Number.isFinite(dt) && dt > 0) {
          speedMps = segDist / dt;
        }
      }
    }
    enriched.push({
      ...point,
      distanceMeters: distance,
      speedMps
    });
  }
  return enriched;
}

export function buildSpeedSegments(
  points: GpsTrackPoint[],
  movingThresholdMps = GPS_TRACK_DEFAULT_MOVING_THRESHOLD_MPS
): GpsSpeedSegment[] {
  const segments: GpsSpeedSegment[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const distanceMeters = haversineMeters(from, to);
    let durationSeconds: number | null = null;
    let speedMps: number | null = to.speedMps ?? null;
    if (from.time && to.time) {
      const dt = (Date.parse(to.time) - Date.parse(from.time)) / 1000;
      if (Number.isFinite(dt) && dt > 0) {
        durationSeconds = dt;
        speedMps = distanceMeters / dt;
      }
    }
    segments.push({
      from,
      to,
      distanceMeters,
      durationSeconds,
      speedMps,
      color: speedColor(speedMps, movingThresholdMps)
    });
  }
  return segments;
}

/** Blue (slow) → teal → amber → red (fast). */
export function speedColor(
  speedMps: number | null,
  movingThresholdMps = GPS_TRACK_DEFAULT_MOVING_THRESHOLD_MPS
): string {
  if (speedMps == null || !Number.isFinite(speedMps)) {
    return '#64748b';
  }
  if (speedMps < movingThresholdMps) {
    return '#94a3b8';
  }
  const t = Math.max(0, Math.min(1, (speedMps - movingThresholdMps) / 6));
  if (t < 0.33) {
    return '#0284c7';
  }
  if (t < 0.66) {
    return '#0d9488';
  }
  if (t < 0.85) {
    return '#d97706';
  }
  return '#dc2626';
}

export function computeMovingTimes(
  segments: GpsSpeedSegment[],
  movingThresholdMps = GPS_TRACK_DEFAULT_MOVING_THRESHOLD_MPS
): { movingTimeSeconds: number | null; stoppedTimeSeconds: number | null } {
  let moving = 0;
  let stopped = 0;
  let hasDuration = false;
  for (const segment of segments) {
    if (segment.durationSeconds == null || segment.durationSeconds <= 0) {
      continue;
    }
    hasDuration = true;
    if (segment.speedMps != null && segment.speedMps >= movingThresholdMps) {
      moving += segment.durationSeconds;
    } else {
      stopped += segment.durationSeconds;
    }
  }
  if (!hasDuration) {
    return { movingTimeSeconds: null, stoppedTimeSeconds: null };
  }
  return { movingTimeSeconds: moving, stoppedTimeSeconds: stopped };
}

export function computeTrackBounds(points: GpsTrackPoint[]): GpxBounds | null {
  if (points.length === 0) {
    return null;
  }
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of points) {
    west = Math.min(west, point.lon);
    east = Math.max(east, point.lon);
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
  }
  return { west, south, east, north };
}

export function buildGpsTrackStats(
  title: string,
  sourceKind: GpsTrackSourceKind,
  tracks: GpsTrackInfo[],
  activePoints: GpsTrackPoint[],
  movingThresholdMps = GPS_TRACK_DEFAULT_MOVING_THRESHOLD_MPS
): GpsTrackStats {
  const segments = buildSpeedSegments(activePoints, movingThresholdMps);
  const { movingTimeSeconds, stoppedTimeSeconds } = computeMovingTimes(segments, movingThresholdMps);
  const elev = elevationDelta(activePoints);
  const elevations = activePoints
    .map((p) => p.ele)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const distanceMeters = pathDistanceMeters(activePoints);
  const times = activePoints
    .map((p) => (p.time ? Date.parse(p.time) : NaN))
    .filter((v) => Number.isFinite(v));
  const durationSeconds =
    times.length >= 2 ? Math.max(0, (Math.max(...times) - Math.min(...times)) / 1000) : null;
  const speeds = segments
    .map((s) => s.speedMps)
    .filter((v): v is number => v != null && Number.isFinite(v) && v >= 0);
  const maxSpeedMps = speeds.length ? Math.max(...speeds) : null;
  const avgSpeedMps =
    durationSeconds != null && durationSeconds > 0 && distanceMeters > 0
      ? distanceMeters / durationSeconds
      : null;
  const avgMovingSpeedMps =
    movingTimeSeconds != null && movingTimeSeconds > 0 && distanceMeters > 0
      ? distanceMeters / movingTimeSeconds
      : null;

  return {
    title,
    sourceKind,
    trackCount: tracks.length,
    pointCount: activePoints.length,
    distanceMeters,
    durationSeconds,
    movingTimeSeconds,
    stoppedTimeSeconds,
    avgSpeedMps,
    maxSpeedMps,
    avgMovingSpeedMps,
    avgPaceMps: avgMovingSpeedMps ?? avgSpeedMps,
    elevationGainMeters: elev.gain,
    elevationLossMeters: elev.loss,
    minElevationMeters: elevations.length ? Math.min(...elevations) : null,
    maxElevationMeters: elevations.length ? Math.max(...elevations) : null,
    bounds: computeTrackBounds(activePoints),
    hasElevation: elevations.length > 0,
    hasTimestamps: times.length >= 2
  };
}

export function collectGpsTrackWarnings(tracks: GpsTrackInfo[], stats: GpsTrackStats): string[] {
  const warnings: string[] = [];
  if (stats.pointCount < 5) {
    warnings.push('Very few points — speed and pace analytics may be unreliable.');
  }
  if (!stats.hasTimestamps) {
    warnings.push('No timestamps — speed, pace, and moving time cannot be calculated.');
  }
  if (!stats.hasElevation) {
    warnings.push('No elevation data — gain/loss stats are unavailable.');
  }
  if (tracks.length > 1) {
    warnings.push(`${tracks.length} tracks found — select one in the sidebar to analyze.`);
  }
  return warnings;
}

export function parseGpsTrackText(
  text: string,
  fileName: string
): { sourceKind: GpsTrackSourceKind; tracks: GpsTrackInfo[]; title: string } {
  if (!text || !text.trim()) {
    throw new Error('Track file is empty');
  }
  const sourceKind = sourceKindForFile(fileName, text);

  if (sourceKind === 'gpx') {
    const doc = parseGpxText(text);
    const tracks: GpsTrackInfo[] = doc.tracks
      .map((track) => ({
        id: track.id,
        name: track.name,
        points: enrichTrackPoints(flattenTrackPoints(track))
      }))
      .filter((track) => track.points.length >= 2);
    if (tracks.length === 0 && doc.routes.length > 0) {
      for (const route of doc.routes) {
        if (route.points.length >= 2) {
          tracks.push({
            id: route.id,
            name: route.name,
            points: enrichTrackPoints(route.points)
          });
        }
      }
    }
    if (tracks.length === 0) {
      throw new Error('GPX file has no usable track or route with 2+ points');
    }
    return { sourceKind, tracks, title: doc.name || fileName };
  }

  if (sourceKind === 'geojson') {
    const points = enrichTrackPoints(parseGpsTrackGeoJson(text));
    return {
      sourceKind,
      tracks: [{ id: 'trk-0', name: fileName.replace(/\.(geojson|json)$/i, '') || 'Track', points }],
      title: fileName.replace(/\.(geojson|json)$/i, '') || 'GeoJSON track'
    };
  }

  const points = enrichTrackPoints(parseGpsTrackCsv(text));
  return {
    sourceKind,
    tracks: [{ id: 'trk-0', name: fileName.replace(/\.(csv|txt)$/i, '') || 'Track', points }],
    title: fileName.replace(/\.(csv|txt)$/i, '') || 'CSV track'
  };
}

export function createGpsTrackFileRecord(
  file: File,
  text: string,
  parsed: { sourceKind: GpsTrackSourceKind; tracks: GpsTrackInfo[]; title: string },
  movingThresholdMps = GPS_TRACK_DEFAULT_MOVING_THRESHOLD_MPS
): GpsTrackLoadedFile {
  const active = parsed.tracks[0]?.points ?? [];
  const stats = buildGpsTrackStats(
    parsed.title,
    parsed.sourceKind,
    parsed.tracks,
    active,
    movingThresholdMps
  );
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    name: file.name,
    size: file.size,
    sourceKind: parsed.sourceKind,
    text,
    tracks: parsed.tracks,
    warnings: collectGpsTrackWarnings(parsed.tracks, stats)
  };
}

export function buildSpeedProfile(points: GpsTrackPoint[]): GpsProfileSample[] {
  const samples: GpsProfileSample[] = [];
  const startTime = points.find((p) => p.time)?.time;
  const startMs = startTime ? Date.parse(startTime) : NaN;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const speedMps = point.speedMps ?? null;
    const paceSecondsPerKm = speedMps != null && speedMps > 0 ? 1000 / speedMps : null;
    const elapsedSeconds =
      point.time && Number.isFinite(startMs)
        ? Math.max(0, (Date.parse(point.time) - startMs) / 1000)
        : null;
    samples.push({
      distanceMeters: point.distanceMeters ?? 0,
      elapsedSeconds,
      speedMps,
      paceSecondsPerKm,
      elevationMeters: point.ele,
      index: i
    });
  }
  return samples;
}

export function buildGpsProfileGeometry(
  samples: GpsProfileSample[],
  metric: 'speed' | 'pace',
  axis: GpsTrackChartAxis = 'distance'
): GpsProfileGeometry {
  const usable = samples.filter((s) => {
    const value = metric === 'speed' ? s.speedMps : s.paceSecondsPerKm;
    const x = axis === 'time' ? s.elapsedSeconds : s.distanceMeters;
    return value != null && Number.isFinite(value) && value > 0 && x != null && Number.isFinite(x);
  });
  if (usable.length < 2) {
    return { linePoints: '', areaPoints: '' };
  }

  const xs = usable.map((s) => (axis === 'time' ? (s.elapsedSeconds as number) : s.distanceMeters));
  const ys = usable.map((s) =>
    metric === 'speed' ? (s.speedMps as number) : (s.paceSecondsPerKm as number)
  );
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) || 1;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = Math.max(1e-6, maxY - minY);
  const spanX = Math.max(1e-6, maxX - minX);

  const coords = usable.map((_sample, i) => {
    const x = ((xs[i] - minX) / spanX) * 100;
    const y = 32 - ((ys[i] - minY) / spanY) * 28;
    return { x, y };
  });
  const linePoints = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const areaPoints = [
    `${coords[0].x.toFixed(2)},36`,
    ...coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`),
    `${coords[coords.length - 1].x.toFixed(2)},36`
  ].join(' ');
  return { linePoints, areaPoints };
}

export function exportPointsCsv(tracks: GpsTrackInfo[], activeTrackId?: string): string {
  const header = ['track', 'lat', 'lon', 'ele', 'time', 'distance_m', 'speed_mps'];
  const rows: string[][] = [];
  for (const track of tracks) {
    if (activeTrackId && track.id !== activeTrackId) {
      continue;
    }
    for (const point of track.points) {
      rows.push([
        track.name,
        String(point.lat),
        String(point.lon),
        point.ele == null ? '' : String(point.ele),
        point.time ?? '',
        point.distanceMeters == null ? '' : String(point.distanceMeters),
        point.speedMps == null ? '' : String(point.speedMps)
      ]);
    }
  }
  if (rows.length === 0) {
    throw new Error('No points available to export');
  }
  return [header.join(','), ...rows.map((cells) => cells.map(csvEscape).join(','))].join('\n');
}

export function exportSpeedProfileCsv(points: GpsTrackPoint[]): string {
  const header = ['index', 'distance_m', 'elapsed_s', 'speed_mps', 'pace_s_per_km', 'ele'];
  const samples = buildSpeedProfile(points);
  const rows = samples.map((sample) => [
    String(sample.index),
    String(sample.distanceMeters),
    sample.elapsedSeconds == null ? '' : String(sample.elapsedSeconds),
    sample.speedMps == null ? '' : String(sample.speedMps),
    sample.paceSecondsPerKm == null ? '' : String(sample.paceSecondsPerKm),
    sample.elevationMeters == null ? '' : String(sample.elevationMeters)
  ]);
  return [header.join(','), ...rows.map((cells) => cells.map(csvEscape).join(','))].join('\n');
}

export function exportSummaryJson(
  file: GpsTrackLoadedFile,
  stats: GpsTrackStats,
  activeTrackId: string
): string {
  return JSON.stringify(
    {
      file: {
        name: file.name,
        size: file.size,
        sourceKind: file.sourceKind,
        warnings: file.warnings
      },
      activeTrackId,
      stats,
      tracks: file.tracks.map((track) => ({
        id: track.id,
        name: track.name,
        pointCount: track.points.length
      }))
    },
    null,
    2
  );
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function canExportOriginal(file: GpsTrackLoadedFile | null): boolean {
  return !!file?.text?.trim();
}

export function resolveGpsTrackSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  hasTimestamps: boolean;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'gps-error',
      title: 'Need a GPS track file?',
      reason:
        'Upload a .gpx, CSV lat/lon table, or LineString GeoJSON with timestamps for speed analytics.',
      actionLabel: 'Related: GPX Viewer',
      path: '/gis-viewers/gpx-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'gps-intro',
      title: 'Start with a movement track',
      reason: 'Drop a GPX/CSV track or load the sample to explore speed coloring and pace charts.',
      actionLabel: 'Related: GPX Viewer',
      path: '/gis-viewers/gpx-viewer'
    };
  }
  if (!state.hasTimestamps) {
    return {
      id: 'gps-no-time',
      title: 'Timestamps recommended',
      reason:
        'Speed and moving-time stats need point timestamps. GPX Viewer still works for geometry-only files.',
      actionLabel: 'Open GPX Viewer',
      path: '/gis-viewers/gpx-viewer'
    };
  }
  return null;
}

export type { GpxUnitSystem };
