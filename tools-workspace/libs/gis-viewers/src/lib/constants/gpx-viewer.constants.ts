import type { GpxRelatedToolLink } from '../types/gpx-viewer.types';

export const GPX_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.gpx'];

export const GPX_ACCEPT_ATTR = '.gpx,application/gpx+xml,application/xml,text/xml';

export const GPX_FORMATS_LABEL = '.gpx';

export const GPX_FORMATS_HINT =
  'GPX 1.1 tracks, routes, and waypoints from GPS devices, Strava, Garmin, or similar apps';

export const GPX_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const GPX_RELATED_TOOLS: ReadonlyArray<GpxRelatedToolLink> = [
  {
    label: 'GPS Track Viewer',
    description: 'Speed, pace, and moving-time analytics',
    path: '/gis-viewers/gps-track-viewer'
  },
  {
    label: 'Drone Flight Path Viewer',
    description: 'Altitude-colored drone paths and climb rates',
    path: '/gis-viewers/drone-flight-path-viewer'
  },
  {
    label: 'GeoJSON Viewer',
    description: 'Interactive map for FeatureCollections',
    path: '/gis-viewers/geojson-viewer'
  }
];

/** Compact coastal hike sample with elevation and timestamps. */
export const GPX_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="EasyToolHub Sample" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Coastal Ridge Sample</name>
    <desc>Short sample hike with elevation for the GPX viewer</desc>
  </metadata>
  <wpt lat="37.8199" lon="-122.4783">
    <name>Trailhead</name>
    <desc>Parking and start</desc>
    <ele>12</ele>
  </wpt>
  <wpt lat="37.8324" lon="-122.4798">
    <name>Overlook</name>
    <desc>Best bay view</desc>
    <ele>118</ele>
  </wpt>
  <rte>
    <name>Ridge Shortcut</name>
    <desc>Optional shorter return</desc>
    <rtept lat="37.8324" lon="-122.4798"><name>Overlook</name><ele>118</ele></rtept>
    <rtept lat="37.8280" lon="-122.4765"><name>Saddle</name><ele>86</ele></rtept>
    <rtept lat="37.8199" lon="-122.4783"><name>Trailhead</name><ele>12</ele></rtept>
  </rte>
  <trk>
    <name>Outbound Climb</name>
    <desc>Main recorded track</desc>
    <trkseg>
      <trkpt lat="37.8199" lon="-122.4783"><ele>12</ele><time>2024-06-15T14:00:00Z</time></trkpt>
      <trkpt lat="37.8215" lon="-122.4778"><ele>28</ele><time>2024-06-15T14:08:00Z</time></trkpt>
      <trkpt lat="37.8232" lon="-122.4772"><ele>45</ele><time>2024-06-15T14:16:00Z</time></trkpt>
      <trkpt lat="37.8250" lon="-122.4770"><ele>62</ele><time>2024-06-15T14:24:00Z</time></trkpt>
      <trkpt lat="37.8268" lon="-122.4778"><ele>79</ele><time>2024-06-15T14:32:00Z</time></trkpt>
      <trkpt lat="37.8285" lon="-122.4788"><ele>95</ele><time>2024-06-15T14:40:00Z</time></trkpt>
      <trkpt lat="37.8302" lon="-122.4794"><ele>108</ele><time>2024-06-15T14:48:00Z</time></trkpt>
      <trkpt lat="37.8324" lon="-122.4798"><ele>118</ele><time>2024-06-15T14:56:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>
`;
