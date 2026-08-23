import { TERRAIN_SAMPLE_BASE64 } from './terrain-viewer.constants';
import type { ContourRelatedToolLink } from '../types/contour-map-viewer.types';

export const CONTOUR_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.tif',
  '.tiff',
  '.geotiff',
  '.geojson',
  '.json'
];

export const CONTOUR_DEM_EXTENSIONS: ReadonlyArray<string> = ['.tif', '.tiff', '.geotiff'];

export const CONTOUR_GEOJSON_EXTENSIONS: ReadonlyArray<string> = ['.geojson', '.json'];

export const CONTOUR_ACCEPT_ATTR =
  '.tif,.tiff,.geotiff,.geojson,.json,image/tiff,image/geotiff,application/geo+json,application/json';

export const CONTOUR_FORMATS_LABEL = '.tif, .tiff, .geotiff, .geojson, .json';

export const CONTOUR_FORMATS_HINT =
  'Elevation GeoTIFF for generated isolines, or GeoJSON LineString/MultiLineString contours';

export const CONTOUR_MAX_FILE_BYTES = 40 * 1024 * 1024;

export const CONTOUR_MAX_PREVIEW_SIDE = 1024;

export const CONTOUR_MAX_LEVELS = 80;

export const CONTOUR_MAX_LABELS = 40;

export const CONTOUR_DEFAULT_MAJOR_EVERY = 5;

export const CONTOUR_RELATED_TOOLS: ReadonlyArray<ContourRelatedToolLink> = [
  {
    label: 'Terrain Viewer',
    description: 'Hillshade, contours, and shaded relief',
    path: '/gis-viewers/terrain-viewer'
  },
  {
    label: 'DEM Viewer',
    description: 'Elevation colormap and height sampling',
    path: '/gis-viewers/dem-viewer'
  },
  {
    label: 'LiDAR Map Viewer',
    description: 'LAS point density and classification',
    path: '/gis-viewers/lidar-map-viewer'
  }
];

/** Same sample DEM bytes as Terrain / DEM viewers — saved as sample-contours.tif. */
export const CONTOUR_SAMPLE_BASE64 = TERRAIN_SAMPLE_BASE64;
