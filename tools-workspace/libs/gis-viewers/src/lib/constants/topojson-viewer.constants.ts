import type { TopoJsonRelatedToolLink, TopoJsonTopology } from '../types/topojson-viewer.types';

export const TOPOJSON_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.topojson', '.json'];

export const TOPOJSON_ACCEPT_ATTR =
  '.topojson,.json,application/json,application/topo+json';

export const TOPOJSON_FORMATS_LABEL = '.topojson, .json';

export const TOPOJSON_FORMATS_HINT =
  'TopoJSON Topology with shared arcs — convert objects to GeoJSON features on the map';

export const TOPOJSON_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const TOPOJSON_RELATED_TOOLS: ReadonlyArray<TopoJsonRelatedToolLink> = [
  {
    label: 'GeoJSON Viewer',
    description: 'Interactive map for FeatureCollections',
    path: '/gis-viewers/geojson-viewer'
  },
  {
    label: 'KML Viewer',
    description: 'Google Earth placemarks and paths',
    path: '/gis-viewers/kml-viewer'
  },
  {
    label: 'KMZ Viewer',
    description: 'Zipped KML packages on a map',
    path: '/gis-viewers/kmz-viewer'
  }
];

/**
 * Compact sample city Topology: landmarks (points), routes (line), parks (polygon),
 * plus an empty object for soft-warning demos. Absolute arcs (no transform).
 */
export const TOPOJSON_SAMPLE_DATA: TopoJsonTopology = {
  type: 'Topology',
  bbox: [-122.5115, 37.7711, -122.3933, 37.7955],
  objects: {
    landmarks: {
      type: 'GeometryCollection',
      geometries: [
        {
          type: 'Point',
          id: 'city-hall',
          coordinates: [-122.4194, 37.7793],
          properties: { name: 'City Hall', category: 'civic', visitors: 1200 }
        },
        {
          type: 'Point',
          id: 'ferry-building',
          coordinates: [-122.3933, 37.7955],
          properties: { name: 'Ferry Building', category: 'landmark', visitors: 4500 }
        }
      ]
    },
    routes: {
      type: 'GeometryCollection',
      geometries: [
        {
          type: 'LineString',
          id: 'market-st',
          arcs: [0],
          properties: { name: 'Market Street Corridor', category: 'route', length_km: 2.1 }
        }
      ]
    },
    parks: {
      type: 'GeometryCollection',
      geometries: [
        {
          type: 'Polygon',
          id: 'golden-gate-park',
          arcs: [[1]],
          properties: { name: 'Golden Gate Park', category: 'park', area_ha: 412 }
        }
      ]
    },
    'empty-layer': {
      type: 'GeometryCollection',
      geometries: []
    }
  },
  arcs: [
    [
      [-122.4194, 37.7793],
      [-122.408, 37.787],
      [-122.3933, 37.7955]
    ],
    [
      [-122.5115, 37.7711],
      [-122.4542, 37.7711],
      [-122.4542, 37.7749],
      [-122.5115, 37.7749],
      [-122.5115, 37.7711]
    ]
  ]
};

export const TOPOJSON_SAMPLE: string = JSON.stringify(TOPOJSON_SAMPLE_DATA, null, 2);
