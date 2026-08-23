import type { GeoJsonRelatedToolLink } from '../types/geojson-viewer.types';

export const GEOJSON_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.geojson', '.json'];

export const GEOJSON_ACCEPT_ATTR = '.geojson,.json,application/geo+json,application/json';

export const GEOJSON_FORMATS_LABEL = '.geojson, .json';

export const GEOJSON_FORMATS_HINT =
  'RFC 7946 Feature, FeatureCollection, or Geometry from GIS tools and APIs';

export const GEOJSON_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const GEOJSON_RELATED_TOOLS: ReadonlyArray<GeoJsonRelatedToolLink> = [
  {
    label: 'Contour Map Viewer',
    description: 'Isolines from DEM or contour GeoJSON',
    path: '/gis-viewers/contour-map-viewer'
  },
  {
    label: 'GPS Track Viewer',
    description: 'Speed and pace analytics for tracks',
    path: '/gis-viewers/gps-track-viewer'
  },
  {
    label: 'GPX Viewer',
    description: 'Tracks, routes, and elevation profile',
    path: '/gis-viewers/gpx-viewer'
  }
];

/** Compact sample: city points + a park polygon + a route line. */
export const GEOJSON_SAMPLE: string = JSON.stringify(
  {
    type: 'FeatureCollection',
    name: 'Sample City Features',
    features: [
      {
        type: 'Feature',
        id: 'city-hall',
        properties: { name: 'City Hall', category: 'civic', visitors: 1200 },
        geometry: { type: 'Point', coordinates: [-122.4194, 37.7793] }
      },
      {
        type: 'Feature',
        id: 'ferry-building',
        properties: { name: 'Ferry Building', category: 'landmark', visitors: 4500 },
        geometry: { type: 'Point', coordinates: [-122.3933, 37.7955] }
      },
      {
        type: 'Feature',
        id: 'golden-gate-park',
        properties: { name: 'Golden Gate Park', category: 'park', area_ha: 412 },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-122.5115, 37.7711],
              [-122.4542, 37.7711],
              [-122.4542, 37.7749],
              [-122.5115, 37.7749],
              [-122.5115, 37.7711]
            ]
          ]
        }
      },
      {
        type: 'Feature',
        id: 'market-st',
        properties: { name: 'Market Street Corridor', category: 'route', length_km: 2.1 },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122.4194, 37.7793],
            [-122.408, 37.787],
            [-122.3933, 37.7955]
          ]
        }
      }
    ]
  },
  null,
  2
);
