import type {
  RasterMapColormap,
  RasterMapRelatedToolLink
} from '../types/raster-map-viewer.types';

export const RASTER_MAP_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.tif',
  '.tiff',
  '.geotiff',
  '.asc'
];

export const RASTER_MAP_ACCEPT_ATTR =
  '.tif,.tiff,.geotiff,.asc,image/tiff,image/geotiff,text/plain';

export const RASTER_MAP_FORMATS_LABEL = '.tif, .tiff, .geotiff, .asc';

export const RASTER_MAP_FORMATS_HINT =
  'Generic rasters: GeoTIFF (bands + stretch) or ESRI ASCII Grid (.asc) with colormap legend';

export const RASTER_MAP_MAX_FILE_BYTES = 40 * 1024 * 1024;

export const RASTER_MAP_MAX_PREVIEW_SIDE = 1024;

export const RASTER_MAP_COLORMAPS: ReadonlyArray<RasterMapColormap> = [
  'grayscale',
  'viridis',
  'terrain',
  'turbo'
];

export const RASTER_MAP_RELATED_TOOLS: ReadonlyArray<RasterMapRelatedToolLink> = [
  {
    label: 'GeoTIFF Viewer',
    description: 'Georeferenced raster preview with band stretch',
    path: '/gis-viewers/geotiff-viewer'
  },
  {
    label: 'DEM Viewer',
    description: 'Elevation colormaps and hillshade',
    path: '/gis-viewers/dem-viewer'
  },
  {
    label: 'Satellite Image Viewer',
    description: 'EO composites, false color IR, and NDVI',
    path: '/gis-viewers/satellite-image-viewer'
  },
  {
    label: 'Contour Map Viewer',
    description: 'Isolines from DEM or contour GeoJSON',
    path: '/gis-viewers/contour-map-viewer'
  }
];

/** Sample ASCII Grid from /tmp/sample-raster.asc */
export const RASTER_MAP_SAMPLE_ASC = `ncols         8
nrows         8
xllcorner     -122.45
yllcorner     37.75
cellsize      0.01
NODATA_value  -9999
10 12 14 16 18 20 22 24
11 13 15 17 19 21 23 25
12 14 16 30 32 22 24 26
13 15 40 45 42 25 26 27
14 16 38 50 48 28 29 30
15 17 20 22 24 26 28 32
16 18 19 21 23 25 27 29
17 19 20 22 24 26 28 30
`;
