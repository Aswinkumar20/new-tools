import type { NetCdfRelatedToolLink } from '../types/netcdf-viewer.types';
import { NETCDF_SAMPLE_BASE64 } from './netcdf-sample.data';

export const NETCDF_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.nc', '.cdf', '.netcdf'];

export const NETCDF_ACCEPT_ATTR = '.nc,.cdf,.netcdf,application/netcdf,application/x-netcdf';

export const NETCDF_FORMATS_LABEL = '.nc (NetCDF classic)';

export const NETCDF_FORMATS_HINT =
  'NetCDF classic grids with variables, dimensions, and attributes. NetCDF-4/HDF5 files should use the HDF5 Viewer. Education/research only.';

export const NETCDF_MAX_FILE_BYTES = 25 * 1024 * 1024;

export { NETCDF_SAMPLE_BASE64 };

export const NETCDF_RELATED_TOOLS: ReadonlyArray<NetCdfRelatedToolLink> = [
  { label: 'HDF5 Viewer', description: 'Hierarchical scientific datasets', path: '/science-viewers/hdf5-viewer' },
  { label: 'Climate Data Viewer', description: 'Climate grids and time series', path: '/science-viewers/climate-data-viewer' },
  { label: 'GRIB Viewer', description: 'Weather model grids', path: '/science-viewers/grib-viewer' }
];
