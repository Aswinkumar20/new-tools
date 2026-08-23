import {
  altitudeColor,
  buildAltitudeProfile,
  buildAltitudeSegments,
  buildDroneFlightStats,
  buildDroneProfileGeometry,
  createSampleDroneCsvFile,
  createSampleDroneFile,
  enrichDronePoints,
  filterValidDroneFiles,
  formatDroneFileSize,
  parseDroneCsv,
  parseDroneText,
  resolveDroneSuggestion
} from './drone-flight-path-viewer.utils';
import { DRONE_SAMPLE_GPX } from '../constants/drone-flight-path-viewer.constants';

describe('drone-flight-path-viewer.utils', () => {
  it('formats sizes and filters supported files including duplicates', () => {
    expect(formatDroneFileSize(2048)).toBe('2.0 KB');
    const gpx = new File(['<gpx></gpx>'], 'a.gpx', { lastModified: 0 });
    const csv = new File(['lat,lon\n1,2'], 'b.csv', { lastModified: 0 });
    const bad = new File(['x'], 'notes.pdf', { lastModified: 0 });
    const dup = new File(['<gpx></gpx>'], 'a.gpx', { lastModified: 0 });
    const result = filterValidDroneFiles([gpx, csv, bad, dup]);
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected.length).toBeGreaterThanOrEqual(2);
  });

  it('creates sample with lastModified 0', () => {
    const sample = createSampleDroneFile();
    expect(sample.name).toBe('mission-bay-survey.gpx');
    expect(sample.lastModified).toBe(0);
    const csv = createSampleDroneCsvFile();
    expect(csv.lastModified).toBe(0);
  });

  it('parses CSV telemetry with flexible headers including photo and battery', () => {
    const csv = `latitude,longitude,alt_amsl,agl,battery,gimbal_pitch,time,photo
37.77,-122.39,10,5,98,-45,2024-08-12T18:00:00Z,0
37.771,-122.389,40,35,90,-20,2024-08-12T18:01:00Z,1
37.772,-122.388,20,15,80,-40,2024-08-12T18:02:00Z,0`;
    const points = parseDroneCsv(csv);
    expect(points).toHaveLength(3);
    expect(points[1].agl).toBe(35);
    expect(points[1].isPhoto).toBe(true);
    expect(points[0].batteryPercent).toBe(98);
  });

  it('builds altitude segments and climb stats from enriched points', () => {
    const points = enrichDronePoints([
      {
        lat: 37.77,
        lon: -122.389,
        amsl: 8,
        agl: 5,
        altitude: 5,
        time: '2024-08-12T18:00:00Z',
        speedMps: null,
        batteryPercent: 98,
        gimbalPitchDeg: -45,
        isPhoto: false,
        name: null
      },
      {
        lat: 37.7704,
        lon: -122.3884,
        amsl: 32,
        agl: 29,
        altitude: 29,
        time: '2024-08-12T18:01:00Z',
        speedMps: null,
        batteryPercent: 94,
        gimbalPitchDeg: -35,
        isPhoto: false,
        name: null
      },
      {
        lat: 37.771,
        lon: -122.387,
        amsl: 48,
        agl: 45,
        altitude: 45,
        time: '2024-08-12T18:02:00Z',
        speedMps: null,
        batteryPercent: 90,
        gimbalPitchDeg: -20,
        isPhoto: true,
        name: null
      }
    ]);
    const segments = buildAltitudeSegments(points);
    expect(segments.length).toBe(2);
    expect(altitudeColor(5, 5, 45)).toMatch(/^#/);
    const stats = buildDroneFlightStats(
      'Test',
      'csv',
      [{ id: 'trk-0', name: 'A', points, photos: [] }],
      points
    );
    expect(stats.pointCount).toBe(3);
    expect(stats.maxAltitudeMeters).toBe(45);
    expect(stats.maxClimbRateMps).toBeGreaterThan(0);
    expect(stats.hasBattery).toBe(true);

    const profile = buildAltitudeProfile(points);
    const geom = buildDroneProfileGeometry(profile);
    expect(geom.linePoints).toContain(',');
  });

  it('parses sample GPX text into a flight with photo waypoints', () => {
    const parsed = parseDroneText(DRONE_SAMPLE_GPX, 'mission-bay-survey.gpx');
    expect(parsed.sourceKind).toBe('gpx');
    expect(parsed.tracks.length).toBe(1);
    expect(parsed.tracks[0].points.length).toBeGreaterThan(5);
    expect(parsed.tracks[0].photos.length).toBeGreaterThanOrEqual(2);
  });

  it('resolves suggestions', () => {
    const intro = resolveDroneSuggestion({
      hasFiles: false,
      hasError: false,
      hasAltitude: false
    });
    expect(intro?.path).toContain('gpx-viewer');
  });
});
