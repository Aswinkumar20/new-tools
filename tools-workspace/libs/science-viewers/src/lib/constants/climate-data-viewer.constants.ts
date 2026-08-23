import type { ClimateRelatedToolLink } from '../types/climate-data-viewer.types';

export const CLIMATE_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.nc',
  '.cdf',
  '.netcdf',
  '.grib',
  '.grb',
  '.grib2',
  '.grb2',
  '.json',
  '.csv',
  '.clim'
];

export const CLIMATE_ACCEPT_ATTR =
  '.nc,.cdf,.netcdf,.grib,.grb,.grib2,.grb2,.json,.csv,.clim,application/netcdf,application/json,text/csv';

export const CLIMATE_FORMATS_LABEL = '.nc, .grib/.grib2, .json, .csv, .clim';

export const CLIMATE_FORMATS_HINT =
  'Climate grids and station series from NetCDF, GRIB2, JSON, CSV, or .clim. Maps and time series stay local. Education/research only.';

export const CLIMATE_MAX_FILE_BYTES = 40 * 1024 * 1024;

export const CLIMATE_RELATED_TOOLS: ReadonlyArray<ClimateRelatedToolLink> = [
  { label: 'NetCDF Viewer', description: 'NetCDF classic climate grids', path: '/science-viewers/netcdf-viewer' },
  { label: 'GRIB Viewer', description: 'Weather model GRIB2 fields', path: '/science-viewers/grib-viewer' },
  { label: 'Simulation Result Viewer', description: 'Simulation fields and slices', path: '/science-viewers/simulation-result-viewer' }
];
