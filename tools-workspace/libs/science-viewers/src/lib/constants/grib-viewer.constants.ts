import type { GribRelatedToolLink } from '../types/grib-viewer.types';
import { GRIB_SAMPLE_BASE64 } from './grib-sample.data';

export const GRIB_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.grib', '.grb', '.grib2', '.grb2'];

export const GRIB_ACCEPT_ATTR = '.grib,.grb,.grib2,.grb2,application/octet-stream';

export const GRIB_FORMATS_LABEL = '.grib, .grb, .grib2';

export const GRIB_FORMATS_HINT =
  'GRIB2 weather and model grids with field browser and heatmap preview. GRIB1 and complex packing may be unsupported — education/research only.';

export const GRIB_MAX_FILE_BYTES = 40 * 1024 * 1024;

export { GRIB_SAMPLE_BASE64 };

export const GRIB_RELATED_TOOLS: ReadonlyArray<GribRelatedToolLink> = [
  { label: 'NetCDF Viewer', description: 'NetCDF climate grids', path: '/science-viewers/netcdf-viewer' },
  { label: 'Climate Data Viewer', description: 'Climate dataset exploration', path: '/science-viewers/climate-data-viewer' },
  { label: 'FITS Viewer', description: 'Astronomical FITS images', path: '/science-viewers/fits-viewer' }
];
