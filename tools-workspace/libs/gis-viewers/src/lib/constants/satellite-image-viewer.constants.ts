import type { SatelliteRelatedToolLink } from '../types/satellite-image-viewer.types';
import { GEOTIFF_SAMPLE_BASE64 } from './geotiff-viewer.constants';

export const SATELLITE_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.tif',
  '.tiff',
  '.geotiff'
];

export const SATELLITE_ACCEPT_ATTR = '.tif,.tiff,.geotiff,image/tiff,image/geotiff';

export const SATELLITE_FORMATS_LABEL = '.tif, .tiff, .geotiff';

export const SATELLITE_FORMATS_HINT =
  'Earth observation GeoTIFF / COG-like single files — true color, false color IR, NDVI';

export const SATELLITE_MAX_FILE_BYTES = 40 * 1024 * 1024;

export const SATELLITE_MAX_PREVIEW_SIDE = 1024;

export const SATELLITE_RELATED_TOOLS: ReadonlyArray<SatelliteRelatedToolLink> = [
  {
    label: 'Raster Map Viewer',
    description: 'Generic stretch, bands, and colormap legend',
    path: '/gis-viewers/raster-map-viewer'
  },
  {
    label: 'GeoTIFF Viewer',
    description: 'Generic raster preview with band stretch',
    path: '/gis-viewers/geotiff-viewer'
  },
  {
    label: 'COG Viewer',
    description: 'Cloud Optimized GeoTIFF streaming & compliance',
    path: '/gis-viewers/cog-viewer'
  }
];

/** Reuse GeoTIFF sample bytes as sample-eo.tif. */
export const SATELLITE_SAMPLE_BASE64 = GEOTIFF_SAMPLE_BASE64;
