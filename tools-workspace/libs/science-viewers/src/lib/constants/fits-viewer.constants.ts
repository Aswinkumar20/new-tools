import type { FitsRelatedToolLink } from '../types/fits-viewer.types';
import { FITS_SAMPLE_BASE64 } from './fits-sample.data';

export const FITS_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.fits', '.fit', '.fts'];

export const FITS_ACCEPT_ATTR = '.fits,.fit,.fts,application/fits';

export const FITS_FORMATS_LABEL = '.fits, .fit, .fts';

export const FITS_FORMATS_HINT =
  'FITS astronomical images with header cards, WCS keywords, and stretch preview. Compressed or table HDUs may have limited support. Education/research only.';

export const FITS_MAX_FILE_BYTES = 50 * 1024 * 1024;

export { FITS_SAMPLE_BASE64 };

export const FITS_RELATED_TOOLS: ReadonlyArray<FitsRelatedToolLink> = [
  { label: 'GRIB Viewer', description: 'Weather model grids', path: '/science-viewers/grib-viewer' },
  { label: 'NetCDF Viewer', description: 'Climate and science grids', path: '/science-viewers/netcdf-viewer' },
  { label: 'HDF5 Viewer', description: 'Hierarchical datasets', path: '/science-viewers/hdf5-viewer' }
];
