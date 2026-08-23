import type { DroneRelatedToolLink } from '../types/drone-flight-path-viewer.types';

export const DRONE_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.gpx',
  '.csv',
  '.txt',
  '.geojson',
  '.json'
];

export const DRONE_ACCEPT_ATTR =
  '.gpx,.csv,.txt,.geojson,.json,application/gpx+xml,application/xml,text/xml,text/csv,text/plain,application/geo+json,application/json';

export const DRONE_FORMATS_LABEL = '.gpx, .csv, .txt, .geojson';

export const DRONE_FORMATS_HINT =
  'Drone GPX / CSV telemetry (lat, lon, alt/agl, battery, gimbal, photo) or GeoJSON LineString with elevation';

export const DRONE_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const DRONE_RELATED_TOOLS: ReadonlyArray<DroneRelatedToolLink> = [
  {
    label: 'GPS Track Viewer',
    description: 'Speed, pace, and moving-time analytics',
    path: '/gis-viewers/gps-track-viewer'
  },
  {
    label: 'GPX Viewer',
    description: 'Tracks, routes, waypoints, and elevation',
    path: '/gis-viewers/gpx-viewer'
  },
  {
    label: 'GeoJSON Viewer',
    description: 'Interactive FeatureCollection map',
    path: '/gis-viewers/geojson-viewer'
  }
];

/**
 * Sample drone flight with altitude variation, AGL, battery, gimbal, and photo triggers.
 * Differentiated from GPS Track (speed) by clear climb/descent and telemetry columns.
 */
export const DRONE_SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="EasyToolHub Drone Flight Sample" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Mission Bay Survey Flight</name>
    <desc>Sample drone path with altitude climb, cruise, and descent</desc>
  </metadata>
  <wpt lat="37.7705" lon="-122.3880">
    <name>Photo 1</name>
    <ele>42</ele>
    <time>2024-08-12T18:02:30Z</time>
  </wpt>
  <wpt lat="37.7720" lon="-122.3865">
    <name>Photo 2</name>
    <ele>48</ele>
    <time>2024-08-12T18:04:00Z</time>
  </wpt>
  <trk>
    <name>Survey Pass A</name>
    <trkseg>
      <trkpt lat="37.7700" lon="-122.3890"><ele>8</ele><time>2024-08-12T18:00:00Z</time></trkpt>
      <trkpt lat="37.7702" lon="-122.3887"><ele>18</ele><time>2024-08-12T18:00:30Z</time></trkpt>
      <trkpt lat="37.7704" lon="-122.3884"><ele>32</ele><time>2024-08-12T18:01:00Z</time></trkpt>
      <trkpt lat="37.7706" lon="-122.3881"><ele>42</ele><time>2024-08-12T18:01:30Z</time></trkpt>
      <trkpt lat="37.7708" lon="-122.3878"><ele>45</ele><time>2024-08-12T18:02:00Z</time></trkpt>
      <trkpt lat="37.7712" lon="-122.3874"><ele>48</ele><time>2024-08-12T18:02:45Z</time></trkpt>
      <trkpt lat="37.7716" lon="-122.3870"><ele>50</ele><time>2024-08-12T18:03:30Z</time></trkpt>
      <trkpt lat="37.7720" lon="-122.3866"><ele>48</ele><time>2024-08-12T18:04:15Z</time></trkpt>
      <trkpt lat="37.7724" lon="-122.3862"><ele>46</ele><time>2024-08-12T18:05:00Z</time></trkpt>
      <trkpt lat="37.7726" lon="-122.3859"><ele>35</ele><time>2024-08-12T18:05:45Z</time></trkpt>
      <trkpt lat="37.7728" lon="-122.3856"><ele>22</ele><time>2024-08-12T18:06:30Z</time></trkpt>
      <trkpt lat="37.7730" lon="-122.3853"><ele>10</ele><time>2024-08-12T18:07:15Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>
`;

export const DRONE_SAMPLE_CSV = `lat,lon,alt_amsl,agl,battery,gimbal_pitch,speed_mps,time,photo
37.7700,-122.3890,8,5,98,-45,0.0,2024-08-12T18:00:00Z,0
37.7702,-122.3887,18,15,96,-40,4.2,2024-08-12T18:00:30Z,0
37.7704,-122.3884,32,29,94,-35,5.1,2024-08-12T18:01:00Z,0
37.7706,-122.3881,42,39,92,-30,5.0,2024-08-12T18:01:30Z,1
37.7708,-122.3878,45,42,90,-25,4.8,2024-08-12T18:02:00Z,0
37.7712,-122.3874,48,45,88,-20,5.2,2024-08-12T18:02:45Z,1
37.7716,-122.3870,50,47,86,-15,5.0,2024-08-12T18:03:30Z,0
37.7720,-122.3866,48,45,84,-20,4.9,2024-08-12T18:04:15Z,1
37.7724,-122.3862,46,43,82,-25,4.7,2024-08-12T18:05:00Z,0
37.7726,-122.3859,35,32,80,-30,4.5,2024-08-12T18:05:45Z,0
37.7728,-122.3856,22,19,78,-40,3.8,2024-08-12T18:06:30Z,0
37.7730,-122.3853,10,7,76,-45,2.1,2024-08-12T18:07:15Z,0
`;
