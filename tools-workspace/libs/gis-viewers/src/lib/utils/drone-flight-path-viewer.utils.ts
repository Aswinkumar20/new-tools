import {
  DRONE_MAX_FILE_BYTES,
  DRONE_SAMPLE_CSV,
  DRONE_SAMPLE_GPX,
  DRONE_SUPPORTED_EXTENSIONS
} from '../constants/drone-flight-path-viewer.constants';
import type {
  DroneAltitudeSample,
  DroneAltitudeSegment,
  DroneFlightPoint,
  DroneFlightStats,
  DroneFlightTrack,
  DroneLoadedFile,
  DronePhotoWaypoint,
  DroneProfileGeometry,
  DroneSourceKind
} from '../types/drone-flight-path-viewer.types';
import type { GpxBounds, GpxPoint, GpxUnitSystem } from '../types/gpx-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';
import {
  flattenTrackPoints,
  formatBounds,
  formatDistance,
  formatDuration,
  formatElevation,
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
  haversineMeters,
  pathDistanceMeters
};

export function ensureDroneStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'droneCss');
}

export function getDroneFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function formatDroneFileSize(bytes: number): string {
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

export function validateDroneFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > DRONE_MAX_FILE_BYTES) {
    return `File is too large (max ${formatDroneFileSize(DRONE_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function isSupportedDroneFile(file: File): boolean {
  const ext = getDroneFileExtension(file.name);
  if (DRONE_SUPPORTED_EXTENSIONS.includes(ext)) {
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

export function filterValidDroneFiles(files: FileList | File[]): {
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

    if (!isSupportedDroneFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .gpx, .csv/.txt, or .geojson)'
      });
      continue;
    }
    const sizeError = validateDroneFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDroneFile(): File {
  return new File([DRONE_SAMPLE_GPX], 'mission-bay-survey.gpx', {
    type: 'application/gpx+xml',
    lastModified: 0
  });
}

export function createSampleDroneCsvFile(): File {
  return new File([DRONE_SAMPLE_CSV], 'mission-bay-telemetry.csv', {
    type: 'text/csv',
    lastModified: 0
  });
}

export async function readDroneFileText(file: File): Promise<string> {
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

function sourceKindForFile(fileName: string, text: string): DroneSourceKind {
  const ext = getDroneFileExtension(fileName);
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
const AMSL_HEADERS = new Set([
  'alt',
  'altitude',
  'altamsl',
  'amsl',
  'elevation',
  'ele',
  'elev',
  'height'
]);
const AGL_HEADERS = new Set(['agl', 'altagl', 'relativealtitude', 'relalt', 'heightagl']);
const TIME_HEADERS = new Set(['time', 'timestamp', 'datetime', 'date', 'utc']);
const BATTERY_HEADERS = new Set(['battery', 'batterypercent', 'batt', 'soc']);
const GIMBAL_HEADERS = new Set(['gimbal', 'gimbalpitch', 'pitch', 'gimbalpitchdeg']);
const SPEED_HEADERS = new Set(['speed', 'speedmps', 'velocity', 'groundspeed']);
const PHOTO_HEADERS = new Set(['photo', 'trigger', 'shutter', 'capture', 'isphoto']);

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

function parsePhotoFlag(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'photo';
}

function toDronePoint(partial: {
  lat: number;
  lon: number;
  amsl?: number | null;
  agl?: number | null;
  time?: string | null;
  speedMps?: number | null;
  batteryPercent?: number | null;
  gimbalPitchDeg?: number | null;
  isPhoto?: boolean;
  name?: string | null;
}): DroneFlightPoint {
  const amsl = partial.amsl ?? null;
  const agl = partial.agl ?? null;
  const altitude = agl != null && Number.isFinite(agl) ? agl : amsl;
  return {
    lat: partial.lat,
    lon: partial.lon,
    amsl: amsl != null && Number.isFinite(amsl) ? amsl : null,
    agl: agl != null && Number.isFinite(agl) ? agl : null,
    altitude: altitude != null && Number.isFinite(altitude) ? altitude : null,
    time: partial.time ?? null,
    speedMps: partial.speedMps ?? null,
    batteryPercent: partial.batteryPercent ?? null,
    gimbalPitchDeg: partial.gimbalPitchDeg ?? null,
    isPhoto: !!partial.isPhoto,
    name: partial.name ?? null
  };
}

export function parseDroneCsv(text: string): DroneFlightPoint[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV telemetry needs a header row and at least one data row');
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const latIdx = headers.findIndex((h) => LAT_HEADERS.has(h));
  const lonIdx = headers.findIndex((h) => LON_HEADERS.has(h));
  if (latIdx < 0 || lonIdx < 0) {
    throw new Error('CSV must include latitude and longitude columns (e.g. lat, lon)');
  }

  const aglIdx = headers.findIndex((h) => AGL_HEADERS.has(h));
  const amslIdx = headers.findIndex((h) => AMSL_HEADERS.has(h) && !AGL_HEADERS.has(h));
  const timeIdx = headers.findIndex((h) => TIME_HEADERS.has(h));
  const batteryIdx = headers.findIndex((h) => BATTERY_HEADERS.has(h));
  const gimbalIdx = headers.findIndex((h) => GIMBAL_HEADERS.has(h));
  const speedIdx = headers.findIndex((h) => SPEED_HEADERS.has(h));
  const photoIdx = headers.findIndex((h) => PHOTO_HEADERS.has(h));

  const points: DroneFlightPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const lat = Number(cells[latIdx]);
    const lon = Number(cells[lonIdx]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      continue;
    }
    const amslRaw = amslIdx >= 0 ? Number(cells[amslIdx]) : NaN;
    const aglRaw = aglIdx >= 0 ? Number(cells[aglIdx]) : NaN;
    const batteryRaw = batteryIdx >= 0 ? Number(cells[batteryIdx]) : NaN;
    const gimbalRaw = gimbalIdx >= 0 ? Number(cells[gimbalIdx]) : NaN;
    const speedRaw = speedIdx >= 0 ? Number(cells[speedIdx]) : NaN;
    const time = timeIdx >= 0 ? (cells[timeIdx] || '').trim() || null : null;
    const isPhoto = photoIdx >= 0 ? parsePhotoFlag(cells[photoIdx] || '') : false;

    points.push(
      toDronePoint({
        lat,
        lon,
        amsl: Number.isFinite(amslRaw) ? amslRaw : null,
        agl: Number.isFinite(aglRaw) ? aglRaw : null,
        time,
        batteryPercent: Number.isFinite(batteryRaw) ? batteryRaw : null,
        gimbalPitchDeg: Number.isFinite(gimbalRaw) ? gimbalRaw : null,
        speedMps: Number.isFinite(speedRaw) ? speedRaw : null,
        isPhoto
      })
    );
  }
  if (points.length < 2) {
    throw new Error('CSV flight has fewer than 2 valid coordinate rows');
  }
  return points;
}

function elevationFromProps(props: GeoJSON.GeoJsonProperties | null | undefined): {
  amsl: number | null;
  agl: number | null;
} {
  if (!props || typeof props !== 'object') {
    return { amsl: null, agl: null };
  }
  const record = props as Record<string, unknown>;
  let amsl: number | null = null;
  let agl: number | null = null;
  for (const key of ['agl', 'alt_agl', 'relativeAltitude', 'rel_alt']) {
    const raw = record[key];
    if (raw == null || raw === '') continue;
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(num)) {
      agl = num;
      break;
    }
  }
  for (const key of ['ele', 'elev', 'elevation', 'alt', 'altitude', 'amsl', 'alt_amsl']) {
    const raw = record[key];
    if (raw == null || raw === '') continue;
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(num)) {
      amsl = num;
      break;
    }
  }
  return { amsl, agl };
}

function collectLineCoords(
  root: GeoJSON.GeoJSON
): { coords: number[][]; props: GeoJSON.GeoJsonProperties } {
  if (root.type === 'Feature') {
    const geom = root.geometry;
    if (geom?.type === 'LineString') {
      return { coords: geom.coordinates as number[][], props: root.properties };
    }
    if (geom?.type === 'MultiLineString') {
      const parts = geom.coordinates as number[][][];
      return { coords: parts.reduce((acc, part) => acc.concat(part), [] as number[][]), props: root.properties };
    }
  }
  if (root.type === 'FeatureCollection') {
    for (const feature of root.features) {
      if (feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString') {
        return collectLineCoords(feature);
      }
    }
  }
  if (root.type === 'LineString') {
    return { coords: root.coordinates as number[][], props: null };
  }
  if (root.type === 'MultiLineString') {
    const parts = root.coordinates as number[][][];
    return {
      coords: parts.reduce((acc, part) => acc.concat(part), [] as number[][]),
      props: null
    };
  }
  throw new Error('Expected a LineString or MultiLineString GeoJSON flight path');
}

export function parseDroneGeoJson(text: string): DroneFlightPoint[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON — could not parse GeoJSON flight path');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('GeoJSON flight path must be an object');
  }
  const { coords, props } = collectLineCoords(parsed as GeoJSON.GeoJSON);
  const elev = elevationFromProps(props);
  const points: DroneFlightPoint[] = [];
  for (const c of coords) {
    const lng = c[0];
    const lat = c[1];
    const ele3 = c.length > 2 ? c[2] : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push(
      toDronePoint({
        lat,
        lon: lng,
        amsl: Number.isFinite(ele3) ? ele3 : elev.amsl,
        agl: elev.agl
      })
    );
  }
  if (points.length < 2) {
    throw new Error('GeoJSON path has fewer than 2 valid points');
  }
  return points;
}

export function enrichDronePoints(points: DroneFlightPoint[]): DroneFlightPoint[] {
  const enriched: DroneFlightPoint[] = [];
  let distance = 0;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let climbRateMps: number | null = null;
    if (i > 0) {
      const prev = points[i - 1];
      const segDist = haversineMeters(
        { lat: prev.lat, lon: prev.lon, ele: null, time: null, name: null },
        { lat: point.lat, lon: point.lon, ele: null, time: null, name: null }
      );
      distance += segDist;
      if (
        prev.time &&
        point.time &&
        prev.altitude != null &&
        point.altitude != null &&
        Number.isFinite(prev.altitude) &&
        Number.isFinite(point.altitude)
      ) {
        const dt = (Date.parse(point.time) - Date.parse(prev.time)) / 1000;
        if (Number.isFinite(dt) && dt > 0) {
          climbRateMps = (point.altitude - prev.altitude) / dt;
        }
      }
    }
    enriched.push({
      ...point,
      distanceMeters: distance,
      climbRateMps
    });
  }
  return enriched;
}

function photosFromPoints(points: DroneFlightPoint[]): DronePhotoWaypoint[] {
  const photos: DronePhotoWaypoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p.isPhoto) continue;
    photos.push({
      lat: p.lat,
      lon: p.lon,
      altitude: p.altitude,
      time: p.time,
      name: p.name || `Photo ${photos.length + 1}`,
      index: i
    });
  }
  return photos;
}

function gpxPointToDrone(p: GpxPoint, isPhoto = false): DroneFlightPoint {
  return toDronePoint({
    lat: p.lat,
    lon: p.lon,
    amsl: p.ele,
    time: p.time,
    name: p.name,
    isPhoto
  });
}

/** Blue (low) → teal → amber → red (high altitude). */
export function altitudeColor(
  altitude: number | null,
  minAlt: number,
  maxAlt: number
): string {
  if (altitude == null || !Number.isFinite(altitude)) {
    return '#64748b';
  }
  const span = Math.max(1e-6, maxAlt - minAlt);
  const t = Math.max(0, Math.min(1, (altitude - minAlt) / span));
  if (t < 0.25) return '#0284c7';
  if (t < 0.5) return '#0d9488';
  if (t < 0.75) return '#d97706';
  return '#dc2626';
}

export function buildAltitudeSegments(points: DroneFlightPoint[]): DroneAltitudeSegment[] {
  const alts = points
    .map((p) => p.altitude)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const minAlt = alts.length ? Math.min(...alts) : 0;
  const maxAlt = alts.length ? Math.max(...alts) : 1;
  const segments: DroneAltitudeSegment[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const midAlt =
      from.altitude != null && to.altitude != null
        ? (from.altitude + to.altitude) / 2
        : (to.altitude ?? from.altitude);
    segments.push({
      from,
      to,
      distanceMeters: haversineMeters(
        { lat: from.lat, lon: from.lon, ele: null, time: null, name: null },
        { lat: to.lat, lon: to.lon, ele: null, time: null, name: null }
      ),
      color: altitudeColor(midAlt ?? null, minAlt, maxAlt)
    });
  }
  return segments;
}

export function computeTrackBounds(points: DroneFlightPoint[]): GpxBounds | null {
  if (points.length === 0) return null;
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

export function buildDroneFlightStats(
  title: string,
  sourceKind: DroneSourceKind,
  tracks: DroneFlightTrack[],
  activePoints: DroneFlightPoint[]
): DroneFlightStats {
  const alts = activePoints
    .map((p) => p.altitude)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const climbRates = activePoints
    .map((p) => p.climbRateMps)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const times = activePoints
    .map((p) => (p.time ? Date.parse(p.time) : NaN))
    .filter((v) => Number.isFinite(v));
  const durationSeconds =
    times.length >= 2 ? Math.max(0, (Math.max(...times) - Math.min(...times)) / 1000) : null;

  let homeDistanceMeters: number | null = null;
  if (activePoints.length >= 2) {
    const home = activePoints[0];
    const end = activePoints[activePoints.length - 1];
    homeDistanceMeters = haversineMeters(
      { lat: home.lat, lon: home.lon, ele: null, time: null, name: null },
      { lat: end.lat, lon: end.lon, ele: null, time: null, name: null }
    );
  }

  const hasAgl = activePoints.some((p) => p.agl != null);
  const hasAmsl = activePoints.some((p) => p.amsl != null);
  const altitudeMode: 'agl' | 'amsl' | 'none' = hasAgl ? 'agl' : hasAmsl ? 'amsl' : 'none';

  const photoCount = tracks.reduce((sum, t) => sum + t.photos.length, 0);

  return {
    title,
    sourceKind,
    trackCount: tracks.length,
    pointCount: activePoints.length,
    photoCount,
    distanceMeters: pathDistanceMeters(
      activePoints.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        ele: p.altitude,
        time: p.time,
        name: p.name
      }))
    ),
    durationSeconds,
    minAltitudeMeters: alts.length ? Math.min(...alts) : null,
    maxAltitudeMeters: alts.length ? Math.max(...alts) : null,
    avgAltitudeMeters: alts.length ? alts.reduce((a, b) => a + b, 0) / alts.length : null,
    maxClimbRateMps: climbRates.length
      ? Math.max(...climbRates.filter((r) => r >= 0), 0)
      : null,
    maxDescentRateMps: climbRates.length
      ? Math.min(...climbRates.filter((r) => r <= 0), 0)
      : null,
    homeDistanceMeters,
    altitudeMode,
    hasBattery: activePoints.some((p) => p.batteryPercent != null),
    hasGimbal: activePoints.some((p) => p.gimbalPitchDeg != null),
    hasTimestamps: times.length >= 2,
    bounds: computeTrackBounds(activePoints)
  };
}

export function collectDroneWarnings(
  tracks: DroneFlightTrack[],
  stats: DroneFlightStats
): string[] {
  const warnings: string[] = [];
  if (stats.pointCount < 5) {
    warnings.push('Very few points — altitude analytics may be unreliable.');
  }
  if (stats.altitudeMode === 'none') {
    warnings.push('No altitude data — path will not be colored by height.');
  }
  if (!stats.hasTimestamps) {
    warnings.push('No timestamps — climb/descent rates and duration are unavailable.');
  }
  if (tracks.length > 1) {
    warnings.push(`${tracks.length} tracks found — select one in the sidebar to analyze.`);
  }
  return warnings;
}

function stemName(fileName: string, kind: DroneSourceKind): string {
  if (kind === 'gpx') {
    return fileName.replace(/\.gpx$/i, '') || 'Flight';
  }
  if (kind === 'geojson') {
    return fileName.replace(/\.(geojson|json)$/i, '') || 'Flight';
  }
  return fileName.replace(/\.(csv|txt)$/i, '') || 'Flight';
}

export function parseDroneText(
  text: string,
  fileName: string
): { sourceKind: DroneSourceKind; tracks: DroneFlightTrack[]; title: string } {
  if (!text || !text.trim()) {
    throw new Error('Flight file is empty');
  }
  const sourceKind = sourceKindForFile(fileName, text);

  if (sourceKind === 'gpx') {
    const doc = parseGpxText(text);
    const photoWpts = doc.waypoints.map((w, i) => ({
      lat: w.lat,
      lon: w.lon,
      altitude: w.ele,
      time: w.time,
      name: w.name || `Photo ${i + 1}`,
      index: i
    }));
    const tracks: DroneFlightTrack[] = doc.tracks
      .map((track) => {
        const points = enrichDronePoints(
          flattenTrackPoints(track).map((p) => gpxPointToDrone(p))
        );
        return {
          id: track.id,
          name: track.name,
          points,
          photos: photoWpts.length ? photoWpts : photosFromPoints(points)
        };
      })
      .filter((track) => track.points.length >= 2);

    if (tracks.length === 0 && doc.routes.length > 0) {
      for (const route of doc.routes) {
        if (route.points.length >= 2) {
          const points = enrichDronePoints(route.points.map((p) => gpxPointToDrone(p)));
          tracks.push({
            id: route.id,
            name: route.name,
            points,
            photos: photoWpts.length ? photoWpts : photosFromPoints(points)
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
    const points = enrichDronePoints(parseDroneGeoJson(text));
    return {
      sourceKind,
      tracks: [
        {
          id: 'trk-0',
          name: stemName(fileName, 'geojson'),
          points,
          photos: photosFromPoints(points)
        }
      ],
      title: stemName(fileName, 'geojson')
    };
  }

  const points = enrichDronePoints(parseDroneCsv(text));
  return {
    sourceKind,
    tracks: [
      {
        id: 'trk-0',
        name: stemName(fileName, 'csv'),
        points,
        photos: photosFromPoints(points)
      }
    ],
    title: stemName(fileName, 'csv')
  };
}

export function createDroneFileRecord(
  file: File,
  text: string,
  parsed: { sourceKind: DroneSourceKind; tracks: DroneFlightTrack[]; title: string }
): DroneLoadedFile {
  const active = parsed.tracks[0]?.points ?? [];
  const stats = buildDroneFlightStats(
    parsed.title,
    parsed.sourceKind,
    parsed.tracks,
    active
  );
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    name: file.name,
    size: file.size,
    sourceKind: parsed.sourceKind,
    text,
    tracks: parsed.tracks,
    warnings: collectDroneWarnings(parsed.tracks, stats)
  };
}

export function buildAltitudeProfile(points: DroneFlightPoint[]): DroneAltitudeSample[] {
  return points.map((point, index) => ({
    distanceMeters: point.distanceMeters ?? 0,
    altitudeMeters: point.altitude,
    index
  }));
}

export function buildDroneProfileGeometry(samples: DroneAltitudeSample[]): DroneProfileGeometry {
  const usable = samples.filter(
    (s) => s.altitudeMeters != null && Number.isFinite(s.altitudeMeters)
  );
  if (usable.length < 2) {
    return { linePoints: '', areaPoints: '' };
  }
  const xs = usable.map((s) => s.distanceMeters);
  const ys = usable.map((s) => s.altitudeMeters as number);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) || 1;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = Math.max(1e-6, maxY - minY);
  const spanX = Math.max(1e-6, maxX - minX);
  const coords = usable.map((_s, i) => {
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

export function exportPathGeoJson(track: DroneFlightTrack): string {
  const coordinates = track.points.map((p) => {
    const coord: number[] = [p.lon, p.lat];
    if (p.altitude != null) coord.push(p.altitude);
    return coord;
  });
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: track.name,
            photoCount: track.photos.length
          },
          geometry: {
            type: 'LineString',
            coordinates
          }
        },
        ...track.photos.map((photo) => ({
          type: 'Feature',
          properties: {
            name: photo.name,
            kind: 'photo',
            altitude: photo.altitude,
            time: photo.time
          },
          geometry: {
            type: 'Point',
            coordinates: [photo.lon, photo.lat]
          }
        }))
      ]
    },
    null,
    2
  );
}

export function exportTelemetryCsv(track: DroneFlightTrack): string {
  const header = [
    'lat',
    'lon',
    'amsl',
    'agl',
    'altitude',
    'time',
    'distance_m',
    'climb_rate_mps',
    'speed_mps',
    'battery',
    'gimbal_pitch',
    'photo'
  ];
  const rows = track.points.map((p) =>
    [
      String(p.lat),
      String(p.lon),
      p.amsl == null ? '' : String(p.amsl),
      p.agl == null ? '' : String(p.agl),
      p.altitude == null ? '' : String(p.altitude),
      p.time ?? '',
      p.distanceMeters == null ? '' : String(p.distanceMeters),
      p.climbRateMps == null ? '' : String(p.climbRateMps),
      p.speedMps == null ? '' : String(p.speedMps),
      p.batteryPercent == null ? '' : String(p.batteryPercent),
      p.gimbalPitchDeg == null ? '' : String(p.gimbalPitchDeg),
      p.isPhoto ? '1' : '0'
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export function exportDroneSummaryJson(
  file: DroneLoadedFile,
  stats: DroneFlightStats,
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
        pointCount: track.points.length,
        photoCount: track.photos.length
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

export function canExportOriginal(file: DroneLoadedFile | null): boolean {
  return !!file?.text?.trim();
}

export function formatClimbRate(
  mps: number | null | undefined,
  units: GpxUnitSystem = 'metric'
): string {
  if (mps == null || !Number.isFinite(mps)) {
    return '—';
  }
  if (units === 'imperial') {
    const fpm = mps * 196.850394;
    return `${fpm.toFixed(0)} ft/min`;
  }
  return `${mps.toFixed(2)} m/s`;
}

export function resolveDroneSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  hasAltitude: boolean;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'drone-error',
      title: 'Need a drone flight file?',
      reason:
        'Upload a .gpx, CSV telemetry (lat/lon/alt/agl), or LineString GeoJSON with elevation.',
      actionLabel: 'Related: GPS Track Viewer',
      path: '/gis-viewers/gps-track-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'drone-intro',
      title: 'Start with a flight path',
      reason:
        'Drop drone GPX/CSV telemetry or load the sample to explore altitude coloring and climb rates.',
      actionLabel: 'Related: GPX Viewer',
      path: '/gis-viewers/gpx-viewer'
    };
  }
  if (!state.hasAltitude) {
    return {
      id: 'drone-no-alt',
      title: 'Altitude recommended',
      reason:
        'Path coloring and climb stats need AGL or AMSL. GPS Track Viewer still works for speed analytics.',
      actionLabel: 'Open GPS Track Viewer',
      path: '/gis-viewers/gps-track-viewer'
    };
  }
  return null;
}

export type { GpxUnitSystem };
