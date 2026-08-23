import {
  averageSpeedMps,
  buildElevationProfile,
  buildGpxStats,
  buildProfileGeometry,
  canExportGpx,
  canExportPointsCsv,
  collectPathPoints,
  createGpxFileRecord,
  exportPointsCsv,
  filterGpxItems,
  filterValidGpxFiles,
  formatDistance,
  formatDuration,
  formatGpxFileSize,
  formatPace,
  formatSpeed,
  isValidLatitude,
  isValidLongitude,
  parseGpxText,
  pathDistanceMeters,
  resolveGpxSuggestion,
  summarizeGpxItems
} from './gpx-viewer.utils';
import { GPX_SAMPLE } from '../constants/gpx-viewer.constants';

describe('gpx-viewer.utils', () => {
  it('formats sizes and filters supported files with validation', () => {
    expect(formatGpxFileSize(500)).toBe('500 B');
    expect(formatGpxFileSize(2048)).toBe('2.0 KB');

    const ok = new File(['<gpx></gpx>'], 'demo.gpx', { type: 'application/gpx+xml' });
    const bad = new File(['x'], 'demo.txt', { type: 'text/plain' });
    const empty = new File([], 'empty.gpx', { type: 'application/gpx+xml' });
    const result = filterValidGpxFiles([ok, bad, empty, ok]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.some((item) => item.name === 'demo.txt')).toBe(true);
    expect(result.rejected.some((item) => item.reason.includes('empty'))).toBe(true);
    expect(result.rejected.some((item) => item.reason.includes('Duplicate'))).toBe(true);
  });

  it('validates coordinates and parses sample GPX', () => {
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
    expect(isValidLatitude(37.8)).toBe(true);

    const data = parseGpxText(GPX_SAMPLE);
    expect(data.name).toBe('Coastal Ridge Sample');
    expect(data.version).toBe('1.1');
    expect(data.tracks).toHaveLength(1);
    expect(data.routes).toHaveLength(1);
    expect(data.waypoints).toHaveLength(2);

    const items = summarizeGpxItems(data);
    expect(items.some((item) => item.kind === 'track')).toBe(true);
    expect(items.some((item) => item.kind === 'route')).toBe(true);
    expect(items.some((item) => item.kind === 'waypoint')).toBe(true);

    const stats = buildGpxStats(data, items);
    expect(stats.title).toBe('Coastal Ridge Sample');
    expect(stats.tracks).toBe(1);
    expect(stats.distanceMeters).toBeGreaterThan(100);
    expect(stats.elevationGainMeters).toBeGreaterThan(50);
    expect(stats.durationSeconds).toBeGreaterThan(0);
    expect(stats.avgSpeedMps).toBeGreaterThan(0);
    expect(stats.hasElevation).toBe(true);
    expect(stats.hasTimestamps).toBe(true);
    expect(stats.bounds).not.toBeNull();

    const profile = buildElevationProfile(collectPathPoints(data));
    expect(profile.length).toBeGreaterThan(3);
    const geometry = buildProfileGeometry(profile);
    expect(geometry.linePoints).toContain(',');
    expect(geometry.areaPoints).toContain(',');

    expect(formatDistance(stats.distanceMeters, 'metric')).toMatch(/km|m/);
    expect(formatDistance(stats.distanceMeters, 'imperial')).toMatch(/mi|ft/);
    expect(formatSpeed(stats.avgSpeedMps, 'metric')).toMatch(/km\/h/);
    expect(formatPace(stats.avgSpeedMps, 'metric')).toMatch(/\/km/);
    expect(formatDuration(stats.durationSeconds)).not.toBe('—');
    expect(averageSpeedMps(1000, 100)).toBe(10);
    expect(filterGpxItems(items, 'track', '').length).toBe(1);
    expect(filterGpxItems(items, 'all', 'overlook').length).toBeGreaterThan(0);

    const csv = exportPointsCsv(data);
    expect(csv).toContain('source,name,lat,lon,ele,time');
    expect(csv).toContain('Outbound Climb');

    const record = createGpxFileRecord(new File([GPX_SAMPLE], 'sample.gpx'), GPX_SAMPLE, data);
    expect(record.name).toBe('sample.gpx');
    expect(record.warnings).toEqual([]);
    expect(canExportGpx(record)).toBe(true);
    expect(canExportPointsCsv(record)).toBe(true);
    expect(pathDistanceMeters(collectPathPoints(data))).toBeGreaterThan(0);
  });

  it('rejects non-GPX XML and empty content', () => {
    expect(() => parseGpxText('<employees></employees>')).toThrow(/Not a GPX/i);
    expect(() => parseGpxText('   ')).toThrow(/empty/i);
  });

  it('resolves suggestions by state', () => {
    expect(resolveGpxSuggestion({ hasFiles: false, hasError: false, trackCount: 0 })?.id).toBe(
      'gpx-intro'
    );
    expect(resolveGpxSuggestion({ hasFiles: true, hasError: true, trackCount: 0 })?.id).toBe(
      'gpx-fix'
    );
    expect(resolveGpxSuggestion({ hasFiles: true, hasError: false, trackCount: 0 })?.id).toBe(
      'gpx-no-track'
    );
  });
});
