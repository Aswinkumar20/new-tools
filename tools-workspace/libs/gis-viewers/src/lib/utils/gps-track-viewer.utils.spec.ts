import {
  buildGpsProfileGeometry,
  buildGpsTrackStats,
  buildSpeedProfile,
  buildSpeedSegments,
  computeMovingTimes,
  createSampleGpsTrackFile,
  enrichTrackPoints,
  filterValidGpsTrackFiles,
  formatGpsTrackFileSize,
  parseGpsTrackCsv,
  parseGpsTrackText,
  resolveGpsTrackSuggestion,
  speedColor
} from './gps-track-viewer.utils';
import { GPS_TRACK_SAMPLE } from '../constants/gps-track-viewer.constants';

describe('gps-track-viewer.utils', () => {
  it('formats sizes and filters supported files including duplicates', () => {
    expect(formatGpsTrackFileSize(1024)).toBe('1.0 KB');
    const gpx = new File(['<gpx></gpx>'], 'a.gpx', { lastModified: 0 });
    const csv = new File(['lat,lon\n1,2'], 'b.csv', { lastModified: 0 });
    const bad = new File(['x'], 'notes.pdf', { lastModified: 0 });
    const dup = new File(['<gpx></gpx>'], 'a.gpx', { lastModified: 0 });
    const result = filterValidGpsTrackFiles([gpx, csv, bad, dup]);
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected.length).toBeGreaterThanOrEqual(2);
  });

  it('creates sample with lastModified 0', () => {
    const sample = createSampleGpsTrackFile();
    expect(sample.name).toBe('harbor-loop-sample.gpx');
    expect(sample.lastModified).toBe(0);
  });

  it('parses CSV tracks with flexible headers', () => {
    const csv = `latitude,longitude,elevation,timestamp
37.80,-122.41,4,2024-07-04T16:00:00Z
37.81,-122.42,8,2024-07-04T16:01:00Z
37.82,-122.43,12,2024-07-04T16:02:00Z`;
    const points = parseGpsTrackCsv(csv);
    expect(points).toHaveLength(3);
    expect(points[0].ele).toBe(4);
    expect(points[1].time).toContain('2024');
  });

  it('builds speed segments, moving time, and formatters', () => {
    const points = enrichTrackPoints([
      { lat: 37.808, lon: -122.4095, ele: 4, time: '2024-07-04T16:00:00Z', name: null },
      { lat: 37.8086, lon: -122.4102, ele: 5, time: '2024-07-04T16:01:00Z', name: null },
      { lat: 37.80861, lon: -122.41021, ele: 5, time: '2024-07-04T16:03:00Z', name: null },
      { lat: 37.81, lon: -122.412, ele: 8, time: '2024-07-04T16:03:30Z', name: null }
    ]);
    const segments = buildSpeedSegments(points, 0.5);
    expect(segments.length).toBe(3);
    expect(speedColor(0.1, 0.5)).toBe('#94a3b8');
    expect(speedColor(3, 0.5)).toMatch(/^#/);
    const moving = computeMovingTimes(segments, 0.5);
    expect(moving.movingTimeSeconds).not.toBeNull();
    expect((moving.stoppedTimeSeconds ?? 0) + (moving.movingTimeSeconds ?? 0)).toBeGreaterThan(0);

    const stats = buildGpsTrackStats(
      'Test',
      'gpx',
      [{ id: 'trk-0', name: 'A', points }],
      points,
      0.5
    );
    expect(stats.pointCount).toBe(4);
    expect(stats.hasTimestamps).toBe(true);
    expect(stats.avgSpeedMps).toBeGreaterThan(0);

    const profile = buildSpeedProfile(points);
    const geom = buildGpsProfileGeometry(profile, 'speed', 'distance');
    expect(geom.linePoints).toContain(',');
  });

  it('parses sample GPX text into multiple tracks', () => {
    const parsed = parseGpsTrackText(GPS_TRACK_SAMPLE, 'harbor-loop-sample.gpx');
    expect(parsed.sourceKind).toBe('gpx');
    expect(parsed.tracks.length).toBe(2);
    expect(parsed.tracks[0].points.length).toBeGreaterThan(5);
  });

  it('resolves suggestions', () => {
    const intro = resolveGpsTrackSuggestion({
      hasFiles: false,
      hasError: false,
      hasTimestamps: false
    });
    expect(intro?.path).toContain('gpx-viewer');
  });
});
