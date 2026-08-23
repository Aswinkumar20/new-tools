import type { VectorTileRelatedToolLink } from '../types/vector-tile-viewer.types';

export const VECTOR_TILE_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.mvt',
  '.pbf',
  '.geojson',
  '.json'
];

export const VECTOR_TILE_ACCEPT_ATTR =
  '.mvt,.pbf,.geojson,.json,application/vnd.mapbox-vector-tile,application/x-protobuf,application/octet-stream,application/geo+json,application/json';

export const VECTOR_TILE_FORMATS_LABEL = '.mvt, .pbf, .geojson';

export const VECTOR_TILE_FORMATS_HINT =
  'Mapbox Vector Tile (.mvt / .pbf) single tiles, optional GeoJSON fallback, or a tile URL template';

export const VECTOR_TILE_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const VECTOR_TILE_LAYER_COLORS: ReadonlyArray<string> = [
  '#0d9488',
  '#2563eb',
  '#c2410c',
  '#7c3aed',
  '#ca8a04',
  '#db2777',
  '#059669',
  '#dc2626'
];

export const VECTOR_TILE_RELATED_TOOLS: ReadonlyArray<VectorTileRelatedToolLink> = [
  {
    label: 'MBTiles Viewer',
    description: 'Offline tile packages on a map',
    path: '/gis-viewers/mbtiles-viewer'
  },
  {
    label: 'GeoJSON Viewer',
    description: 'Inspect FeatureCollections and attributes',
    path: '/gis-viewers/geojson-viewer'
  },
  {
    label: 'TopoJSON Viewer',
    description: 'Topology-preserving map data',
    path: '/gis-viewers/topojson-viewer'
  }
];

/**
 * Tiny MVT sample (landuse / Park polygon). Matches /tmp/sample.mvt.b64.
 * Treat as z=0, x=0, y=0 for world placement.
 */
export const VECTOR_TILE_SAMPLE_BASE64 =
  'Gjt4AgoHbGFuZHVzZRIdCAESAgAAGAMiEwnADMAMIsAlAADAJb8lAAC/JQ8aBG5hbWUiBgoEUGFyayiAIA==';

export const VECTOR_TILE_SAMPLE_Z = 0;
export const VECTOR_TILE_SAMPLE_X = 0;
export const VECTOR_TILE_SAMPLE_Y = 0;
