import type { GpsTrackRelatedToolLink } from '../types/gps-track-viewer.types';

export const GPS_TRACK_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.gpx',
  '.csv',
  '.txt',
  '.geojson',
  '.json'
];

export const GPS_TRACK_ACCEPT_ATTR =
  '.gpx,.csv,.txt,.geojson,.json,application/gpx+xml,application/xml,text/xml,text/csv,text/plain,application/geo+json,application/json';

export const GPS_TRACK_FORMATS_LABEL = '.gpx, .csv, .txt, .geojson';

export const GPS_TRACK_FORMATS_HINT =
  'GPX tracks, CSV lat/lon/time/ele tables, or GeoJSON LineString with optional time properties';

export const GPS_TRACK_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const GPS_TRACK_DEFAULT_MOVING_THRESHOLD_MPS = 0.5;

export const GPS_TRACK_RELATED_TOOLS: ReadonlyArray<GpsTrackRelatedToolLink> = [
  {
    label: 'Drone Flight Path Viewer',
    description: 'Altitude-colored drone paths and climb rates',
    path: '/gis-viewers/drone-flight-path-viewer'
  },
  {
    label: 'GPX Viewer',
    description: 'Tracks, routes, waypoints, and elevation profile',
    path: '/gis-viewers/gpx-viewer'
  },
  {
    label: 'GeoJSON Viewer',
    description: 'Interactive FeatureCollection map',
    path: '/gis-viewers/geojson-viewer'
  }
];

/**
 * Richer sample with clear speed changes (walk → stop → fast → slow).
 * Timestamps spaced for moving-time and speed-color analytics.
 */
export const GPS_TRACK_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="EasyToolHub GPS Track Sample" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Harbor Loop Speed Sample</name>
    <desc>Sample GPS track with walk, pause, and sprint segments for speed analytics</desc>
  </metadata>
  <trk>
    <name>Harbor Loop</name>
    <desc>Primary recorded track</desc>
    <trkseg>
      <trkpt lat="37.8080" lon="-122.4095"><ele>4</ele><time>2024-07-04T16:00:00Z</time></trkpt>
      <trkpt lat="37.8086" lon="-122.4102"><ele>5</ele><time>2024-07-04T16:01:00Z</time></trkpt>
      <trkpt lat="37.8092" lon="-122.4110"><ele>6</ele><time>2024-07-04T16:02:00Z</time></trkpt>
      <trkpt lat="37.8098" lon="-122.4118"><ele>7</ele><time>2024-07-04T16:03:00Z</time></trkpt>
      <trkpt lat="37.8104" lon="-122.4125"><ele>8</ele><time>2024-07-04T16:04:00Z</time></trkpt>
      <trkpt lat="37.8105" lon="-122.4126"><ele>8</ele><time>2024-07-04T16:05:30Z</time></trkpt>
      <trkpt lat="37.8106" lon="-122.4127"><ele>8</ele><time>2024-07-04T16:07:00Z</time></trkpt>
      <trkpt lat="37.8114" lon="-122.4138"><ele>10</ele><time>2024-07-04T16:07:30Z</time></trkpt>
      <trkpt lat="37.8122" lon="-122.4150"><ele>12</ele><time>2024-07-04T16:08:00Z</time></trkpt>
      <trkpt lat="37.8130" lon="-122.4162"><ele>14</ele><time>2024-07-04T16:08:30Z</time></trkpt>
      <trkpt lat="37.8136" lon="-122.4170"><ele>15</ele><time>2024-07-04T16:09:30Z</time></trkpt>
      <trkpt lat="37.8140" lon="-122.4176"><ele>16</ele><time>2024-07-04T16:10:30Z</time></trkpt>
      <trkpt lat="37.8142" lon="-122.4178"><ele>16</ele><time>2024-07-04T16:11:00Z</time></trkpt>
    </trkseg>
  </trk>
  <trk>
    <name>Pier Shortcut</name>
    <desc>Secondary shorter track</desc>
    <trkseg>
      <trkpt lat="37.8080" lon="-122.4095"><ele>4</ele><time>2024-07-04T16:20:00Z</time></trkpt>
      <trkpt lat="37.8088" lon="-122.4108"><ele>6</ele><time>2024-07-04T16:21:00Z</time></trkpt>
      <trkpt lat="37.8096" lon="-122.4120"><ele>8</ele><time>2024-07-04T16:22:00Z</time></trkpt>
      <trkpt lat="37.8104" lon="-122.4132"><ele>10</ele><time>2024-07-04T16:23:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>
`;
