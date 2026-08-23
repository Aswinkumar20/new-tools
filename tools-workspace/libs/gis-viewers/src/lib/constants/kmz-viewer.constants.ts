import type { KmzRelatedToolLink } from '../types/kmz-viewer.types';

export const KMZ_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.kmz'];

export const KMZ_ACCEPT_ATTR =
  '.kmz,application/vnd.google-earth.kmz,application/zip';

export const KMZ_FORMATS_LABEL = '.kmz';

export const KMZ_FORMATS_HINT =
  'Zipped KML packages from Google Earth — placemarks, paths, and polygons (embedded images ignored)';

export const KMZ_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const KMZ_RELATED_TOOLS: ReadonlyArray<KmzRelatedToolLink> = [
  {
    label: 'KML Viewer',
    description: 'Open plain .kml documents on a map',
    path: '/gis-viewers/kml-viewer'
  },
  {
    label: 'GeoJSON Viewer',
    description: 'Interactive map for FeatureCollections',
    path: '/gis-viewers/geojson-viewer'
  },
  {
    label: 'Shapefile Viewer',
    description: 'Classic GIS shapefiles on a map',
    path: '/gis-viewers/shapefile-viewer'
  }
];
