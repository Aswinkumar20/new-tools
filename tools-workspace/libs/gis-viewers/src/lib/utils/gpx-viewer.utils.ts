import {
  GPX_MAX_FILE_BYTES,
  GPX_SUPPORTED_EXTENSIONS
} from '../constants/gpx-viewer.constants';
import type {
  GpxBounds,
  GpxDiagramStats,
  GpxDocument,
  GpxElevationSample,
  GpxItemFilter,
  GpxItemKind,
  GpxItemSummary,
  GpxLoadedFile,
  GpxPoint,
  GpxProfileGeometry,
  GpxRoute,
  GpxTrack,
  GpxUnitSystem,
  GpxWaypoint
} from '../types/gpx-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';

export { configureLeafletDefaultIcons, downloadTextFile, loadLeaflet };

const EARTH_RADIUS_M = 6371000;
const MIN_PATH_POINTS = 2;

export function ensureGpxStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'gpxCss');
}

export function getGpxFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isSupportedGpxFile(file: File): boolean {
  const ext = getGpxFileExtension(file.name);
  if (GPX_SUPPORTED_EXTENSIONS.includes(ext)) {
    return true;
  }
  const type = (file.type || '').toLowerCase();
  return type.includes('gpx') || type === 'application/xml' || type === 'text/xml';
}

export function validateGpxFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > GPX_MAX_FILE_BYTES) {
    return `File is too large (max ${formatGpxFileSize(GPX_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidGpxFiles(files: FileList | File[]): {
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

    if (!isSupportedGpxFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .gpx)' });
      continue;
    }
    const sizeError = validateGpxFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function formatGpxFileSize(bytes: number): string {
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

export async function readGpxFileText(file: File): Promise<string> {
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

function parseNumber(value: string | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

function parsePoint(el: Element): GpxPoint | null {
  const lat = parseNumber(el.getAttribute('lat'));
  const lon = parseNumber(el.getAttribute('lon'));
  if (lat == null || lon == null || !isValidLatitude(lat) || !isValidLongitude(lon)) {
    return null;
  }
  const ele = parseNumber(textOf(el, 'ele'));
  return {
    lat,
    lon,
    ele: ele != null && Number.isFinite(ele) ? ele : null,
    time: textOf(el, 'time'),
    name: textOf(el, 'name')
  };
}

function looksLikeGpx(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  if (!trimmed) {
    return false;
  }
  return /<gpx\b/i.test(trimmed.slice(0, 8000));
}

export function parseGpxText(text: string): GpxDocument {
  if (!text || !text.trim()) {
    throw new Error('GPX file is empty');
  }
  if (!looksLikeGpx(text)) {
    throw new Error('Not a GPX document — expected an XML file with a <gpx> root element');
  }
  if (typeof DOMParser === 'undefined') {
    throw new Error('XML parser is not available in this environment');
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid GPX XML — could not parse the document');
  }
  const root =
    doc.documentElement && localName(doc.documentElement) === 'gpx'
      ? doc.documentElement
      : Array.from(doc.getElementsByTagName('*')).find((el) => localName(el) === 'gpx') ?? null;
  if (!root) {
    throw new Error('GPX root element <gpx> was not found');
  }

  const metadata = firstChild(root, 'metadata');
  const name = textOf(metadata, 'name') || textOf(root, 'name') || 'GPX activity';
  const description = textOf(metadata, 'desc') || textOf(root, 'desc');
  const creator = root.getAttribute('creator');
  const version = root.getAttribute('version');

  const waypoints: GpxWaypoint[] = childElements(root, 'wpt')
    .map((el, index) => {
      const point = parsePoint(el);
      if (!point) {
        return null;
      }
      return {
        ...point,
        id: `wpt-${index}`,
        description: textOf(el, 'desc')
      };
    })
    .filter((item): item is GpxWaypoint => !!item);

  const routes: GpxRoute[] = childElements(root, 'rte').map((el, index) => {
    const points = childElements(el, 'rtept')
      .map((pt) => parsePoint(pt))
      .filter((pt): pt is GpxPoint => !!pt);
    return {
      id: `rte-${index}`,
      name: textOf(el, 'name') || `Route ${index + 1}`,
      description: textOf(el, 'desc'),
      points
    };
  });

  const tracks: GpxTrack[] = childElements(root, 'trk').map((el, index) => {
    const segments = childElements(el, 'trkseg').map((seg) => ({
      points: childElements(seg, 'trkpt')
        .map((pt) => parsePoint(pt))
        .filter((pt): pt is GpxPoint => !!pt)
    }));
    return {
      id: `trk-${index}`,
      name: textOf(el, 'name') || `Track ${index + 1}`,
      description: textOf(el, 'desc'),
      segments
    };
  });

  if (waypoints.length === 0 && tracks.length === 0 && routes.length === 0) {
    throw new Error('GPX file has no tracks, routes, or waypoints');
  }

  const usableTracks = tracks.filter((track) => flattenTrackPoints(track).length >= MIN_PATH_POINTS);
  const usableRoutes = routes.filter((route) => route.points.length >= 1);
  if (usableTracks.length === 0 && usableRoutes.length === 0 && waypoints.length === 0) {
    throw new Error('GPX file has no usable points (check latitude/longitude values)');
  }

  return {
    name,
    description,
    creator: creator?.trim() || null,
    version: version?.trim() || null,
    waypoints,
    tracks,
    routes
  };
}

/** Soft warnings after a successful parse — shown in the UI, not hard failures. */
export function collectGpxWarnings(doc: GpxDocument): string[] {
  const warnings: string[] = [];
  const pathPoints = collectPathPoints(doc);
  const elevCount = pathPoints.filter((point) => point.ele != null).length;
  const timeCount = pathPoints.filter((point) => !!point.time).length;

  if (doc.tracks.length === 0 && doc.routes.length === 0) {
    warnings.push('No tracks or routes — only waypoints will appear on the map.');
  }
  for (const track of doc.tracks) {
    const count = flattenTrackPoints(track).length;
    if (count < MIN_PATH_POINTS) {
      warnings.push(`Track “${track.name}” has fewer than ${MIN_PATH_POINTS} points and cannot be drawn as a line.`);
    }
  }
  if (pathPoints.length >= MIN_PATH_POINTS && elevCount === 0) {
    warnings.push('No elevation data — the elevation profile is unavailable.');
  } else if (pathPoints.length >= MIN_PATH_POINTS && elevCount < pathPoints.length * 0.5) {
    warnings.push('Elevation is sparse — the profile may look incomplete.');
  }
  if (pathPoints.length >= MIN_PATH_POINTS && timeCount < 2) {
    warnings.push('No usable timestamps — duration and average speed cannot be calculated.');
  }
  if (doc.version && !/^1\.[01]$/.test(doc.version)) {
    warnings.push(`Unusual GPX version “${doc.version}” — parsing may be incomplete.`);
  }
  return warnings;
}

export function createGpxFileRecord(file: File, text: string, data: GpxDocument): GpxLoadedFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    text,
    data,
    warnings: collectGpxWarnings(data)
  };
}

export function haversineMeters(a: GpxPoint, b: GpxPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathDistanceMeters(points: GpxPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

export function elevationDelta(points: GpxPoint[]): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  let previous: number | null = null;
  for (const point of points) {
    if (point.ele == null) {
      continue;
    }
    if (previous != null) {
      const delta = point.ele - previous;
      if (delta > 0) {
        gain += delta;
      } else if (delta < 0) {
        loss += -delta;
      }
    }
    previous = point.ele;
  }
  return { gain, loss };
}

export function durationSeconds(points: GpxPoint[]): number | null {
  const times = points
    .map((point) => (point.time ? Date.parse(point.time) : NaN))
    .filter((value) => Number.isFinite(value));
  if (times.length < 2) {
    return null;
  }
  const start = Math.min(...times);
  const end = Math.max(...times);
  return Math.max(0, (end - start) / 1000);
}

export function averageSpeedMps(distanceMeters: number, durationSec: number | null): number | null {
  if (durationSec == null || durationSec <= 0 || !Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return null;
  }
  return distanceMeters / durationSec;
}

export function flattenTrackPoints(track: GpxTrack): GpxPoint[] {
  return track.segments.flatMap((segment) => segment.points);
}

export function summarizeGpxItems(doc: GpxDocument): GpxItemSummary[] {
  const items: GpxItemSummary[] = [];
  let index = 0;

  for (const track of doc.tracks) {
    const points = flattenTrackPoints(track);
    const elev = elevationDelta(points);
    const distance = pathDistanceMeters(points);
    const duration = durationSeconds(points);
    items.push({
      id: track.id,
      index: index++,
      name: track.name,
      kind: 'track',
      pointCount: points.length,
      distanceMeters: distance,
      elevationGainMeters: elev.gain,
      elevationLossMeters: elev.loss,
      durationSeconds: duration,
      avgSpeedMps: averageSpeedMps(distance, duration),
      preview: track.description || `${points.length} points · ${formatDistance(distance, 'metric')}`
    });
  }

  for (const route of doc.routes) {
    const elev = elevationDelta(route.points);
    const distance = pathDistanceMeters(route.points);
    const duration = durationSeconds(route.points);
    items.push({
      id: route.id,
      index: index++,
      name: route.name,
      kind: 'route',
      pointCount: route.points.length,
      distanceMeters: distance,
      elevationGainMeters: elev.gain,
      elevationLossMeters: elev.loss,
      durationSeconds: duration,
      avgSpeedMps: averageSpeedMps(distance, duration),
      preview: route.description || `${route.points.length} points · ${formatDistance(distance, 'metric')}`
    });
  }

  for (const waypoint of doc.waypoints) {
    items.push({
      id: waypoint.id,
      index: index++,
      name: waypoint.name || `Waypoint ${index}`,
      kind: 'waypoint',
      pointCount: 1,
      distanceMeters: 0,
      elevationGainMeters: 0,
      elevationLossMeters: 0,
      durationSeconds: null,
      avgSpeedMps: null,
      preview:
        waypoint.description ||
        `${waypoint.lat.toFixed(5)}, ${waypoint.lon.toFixed(5)}${
          waypoint.ele != null ? ` · ${Math.round(waypoint.ele)} m` : ''
        }`
    });
  }

  return items;
}

export function countItemsByKind(items: GpxItemSummary[]): Record<GpxItemFilter, number> {
  const counts: Record<GpxItemFilter, number> = {
    all: items.length,
    track: 0,
    route: 0,
    waypoint: 0
  };
  for (const item of items) {
    counts[item.kind] += 1;
  }
  return counts;
}

export function filterGpxItems(
  items: GpxItemSummary[],
  kind: GpxItemFilter,
  query: string
): GpxItemSummary[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (kind !== 'all' && item.kind !== kind) {
      return false;
    }
    if (!q) {
      return true;
    }
    const haystack = `${item.name} ${item.id} ${item.kind} ${item.preview}`.toLowerCase();
    return haystack.includes(q);
  });
}

function visitPoint(
  bounds: { west: number; south: number; east: number; north: number; found: boolean },
  point: GpxPoint
): void {
  bounds.west = Math.min(bounds.west, point.lon);
  bounds.east = Math.max(bounds.east, point.lon);
  bounds.south = Math.min(bounds.south, point.lat);
  bounds.north = Math.max(bounds.north, point.lat);
  bounds.found = true;
}

export function computeGpxBounds(doc: GpxDocument): GpxBounds | null {
  const bounds = {
    west: Infinity,
    south: Infinity,
    east: -Infinity,
    north: -Infinity,
    found: false
  };
  for (const waypoint of doc.waypoints) {
    visitPoint(bounds, waypoint);
  }
  for (const route of doc.routes) {
    for (const point of route.points) {
      visitPoint(bounds, point);
    }
  }
  for (const track of doc.tracks) {
    for (const point of flattenTrackPoints(track)) {
      visitPoint(bounds, point);
    }
  }
  if (!bounds.found) {
    return null;
  }
  return {
    west: bounds.west,
    south: bounds.south,
    east: bounds.east,
    north: bounds.north
  };
}

export function collectPathPoints(doc: GpxDocument): GpxPoint[] {
  const points: GpxPoint[] = [];
  for (const track of doc.tracks) {
    points.push(...flattenTrackPoints(track));
  }
  if (points.length === 0) {
    for (const route of doc.routes) {
      points.push(...route.points);
    }
  }
  return points;
}

function collectFallbackRoutePoints(doc: GpxDocument): GpxPoint[] {
  return doc.routes.flatMap((route) => route.points);
}

export function buildElevationProfile(points: GpxPoint[]): GpxElevationSample[] {
  const samples: GpxElevationSample[] = [];
  let distance = 0;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (i > 0) {
      distance += haversineMeters(points[i - 1], point);
    }
    if (point.ele == null) {
      continue;
    }
    samples.push({
      distanceMeters: distance,
      elevationMeters: point.ele,
      lat: point.lat,
      lon: point.lon,
      index: samples.length
    });
  }
  return samples;
}

export function buildProfileGeometry(samples: GpxElevationSample[]): GpxProfileGeometry {
  if (samples.length < 2) {
    return { linePoints: '', areaPoints: '' };
  }
  const maxDistance = samples[samples.length - 1].distanceMeters || 1;
  const elevations = samples.map((sample) => sample.elevationMeters);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const span = Math.max(1, maxEle - minEle);
  const coords = samples.map((sample) => {
    const x = (sample.distanceMeters / maxDistance) * 100;
    const y = 32 - ((sample.elevationMeters - minEle) / span) * 28;
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

export function buildGpxStats(doc: GpxDocument, items: GpxItemSummary[]): GpxDiagramStats {
  const trackPoints = collectPathPoints(doc);
  const routePoints = collectFallbackRoutePoints(doc);
  const pathPoints = trackPoints.length ? trackPoints : routePoints;
  const elev = elevationDelta(pathPoints);
  const elevations = pathPoints
    .map((point) => point.ele)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const duration = durationSeconds(pathPoints);
  const distance = pathDistanceMeters(pathPoints);
  const counts = countItemsByKind(items);
  return {
    title: doc.name,
    tracks: counts.track,
    routes: counts.route,
    waypoints: counts.waypoint,
    points: trackPoints.length + routePoints.length + doc.waypoints.length,
    distanceMeters: distance,
    elevationGainMeters: elev.gain,
    elevationLossMeters: elev.loss,
    minElevationMeters: elevations.length ? Math.min(...elevations) : null,
    maxElevationMeters: elevations.length ? Math.max(...elevations) : null,
    durationSeconds: duration,
    avgSpeedMps: averageSpeedMps(distance, duration),
    movingSpeedMps: averageSpeedMps(distance, duration),
    bounds: computeGpxBounds(doc),
    hasElevation: elevations.length > 0,
    hasTimestamps: duration != null
  };
}

export function formatDistance(meters: number, units: GpxUnitSystem = 'metric'): string {
  if (!Number.isFinite(meters) || meters <= 0) {
    return units === 'imperial' ? '0 ft' : '0 m';
  }
  if (units === 'imperial') {
    const miles = meters / 1609.344;
    if (miles < 0.1) {
      return `${Math.round(meters * 3.28084)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return '—';
  }
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

export function formatElevation(meters: number | null | undefined, units: GpxUnitSystem = 'metric'): string {
  if (meters == null || !Number.isFinite(meters)) {
    return '—';
  }
  if (units === 'imperial') {
    return `${Math.round(meters * 3.28084)} ft`;
  }
  return `${Math.round(meters)} m`;
}

export function formatSpeed(mps: number | null, units: GpxUnitSystem = 'metric'): string {
  if (mps == null || !Number.isFinite(mps) || mps <= 0) {
    return '—';
  }
  if (units === 'imperial') {
    const mph = mps * 2.236936;
    return `${mph.toFixed(1)} mph`;
  }
  const kph = mps * 3.6;
  return `${kph.toFixed(1)} km/h`;
}

export function formatPace(mps: number | null, units: GpxUnitSystem = 'metric'): string {
  if (mps == null || !Number.isFinite(mps) || mps <= 0) {
    return '—';
  }
  const secondsPerUnit = units === 'imperial' ? 1609.344 / mps : 1000 / mps;
  if (!Number.isFinite(secondsPerUnit) || secondsPerUnit > 3600) {
    return '—';
  }
  const minutes = Math.floor(secondsPerUnit / 60);
  const seconds = Math.round(secondsPerUnit % 60);
  const unit = units === 'imperial' ? '/mi' : '/km';
  return `${minutes}:${seconds.toString().padStart(2, '0')}${unit}`;
}

export function formatBounds(bounds: GpxBounds | null): string {
  if (!bounds) {
    return '—';
  }
  return `${bounds.south.toFixed(4)}, ${bounds.west.toFixed(4)} → ${bounds.north.toFixed(4)}, ${bounds.east.toFixed(4)}`;
}

export function canExportGpx(file: GpxLoadedFile | null): boolean {
  return !!file?.text?.trim();
}

export function canExportPointsCsv(file: GpxLoadedFile | null): boolean {
  if (!file) {
    return false;
  }
  const doc = file.data;
  return (
    doc.waypoints.length > 0 ||
    doc.tracks.some((track) => flattenTrackPoints(track).length > 0) ||
    doc.routes.some((route) => route.points.length > 0)
  );
}

export function canExportSummary(file: GpxLoadedFile | null, stats: GpxDiagramStats | null): boolean {
  return !!file && !!stats;
}

export function exportPointsCsv(doc: GpxDocument): string {
  const header = ['source', 'name', 'lat', 'lon', 'ele', 'time'];
  const rows: string[][] = [];

  for (const track of doc.tracks) {
    for (const point of flattenTrackPoints(track)) {
      rows.push([
        'track',
        track.name,
        String(point.lat),
        String(point.lon),
        point.ele == null ? '' : String(point.ele),
        point.time ?? ''
      ]);
    }
  }
  for (const route of doc.routes) {
    for (const point of route.points) {
      rows.push([
        'route',
        route.name,
        String(point.lat),
        String(point.lon),
        point.ele == null ? '' : String(point.ele),
        point.time ?? ''
      ]);
    }
  }
  for (const waypoint of doc.waypoints) {
    rows.push([
      'waypoint',
      waypoint.name || waypoint.id,
      String(waypoint.lat),
      String(waypoint.lon),
      waypoint.ele == null ? '' : String(waypoint.ele),
      waypoint.time ?? ''
    ]);
  }

  if (rows.length === 0) {
    throw new Error('No points available to export');
  }

  return [header.join(','), ...rows.map((cells) => cells.map(csvEscape).join(','))].join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportSummaryJson(
  file: GpxLoadedFile,
  stats: GpxDiagramStats,
  items: GpxItemSummary[]
): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size, warnings: file.warnings },
      stats,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        pointCount: item.pointCount,
        distanceMeters: item.distanceMeters,
        elevationGainMeters: item.elevationGainMeters,
        elevationLossMeters: item.elevationLossMeters,
        durationSeconds: item.durationSeconds,
        avgSpeedMps: item.avgSpeedMps
      }))
    },
    null,
    2
  );
}

export function resolveGpxSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  trackCount: number;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'gpx-fix',
      title: 'Need a valid GPX file?',
      reason: 'Upload a GPX 1.0/1.1 export from a GPS watch, phone, or mapping app (.gpx).',
      actionLabel: 'Related: GeoJSON maps',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'gpx-intro',
      title: 'Start with a GPS track',
      reason: 'Drop a .gpx file or load the sample coastal hike to explore the map and elevation profile.',
      actionLabel: 'Related: GeoJSON maps',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  if (state.trackCount === 0) {
    return {
      id: 'gpx-no-track',
      title: 'No tracks in this file',
      reason: 'Routes and waypoints still appear on the map. Elevation profile uses track or route points when available.',
      actionLabel: 'Related: KML maps',
      path: '/gis-viewers/kml-viewer'
    };
  }
  return null;
}

export function kindLabel(kind: GpxItemKind): string {
  switch (kind) {
    case 'track':
      return 'Track';
    case 'route':
      return 'Route';
    case 'waypoint':
      return 'Waypoint';
  }
}

export function pointsForItem(doc: GpxDocument, itemId: string): GpxPoint[] {
  const track = doc.tracks.find((entry) => entry.id === itemId);
  if (track) {
    return flattenTrackPoints(track);
  }
  const route = doc.routes.find((entry) => entry.id === itemId);
  if (route) {
    return route.points;
  }
  const waypoint = doc.waypoints.find((entry) => entry.id === itemId);
  return waypoint ? [waypoint] : [];
}
