import type { SimulationRelatedToolLink } from '../types/simulation-result-viewer.types';

export const SIM_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.csv', '.vtk', '.sim', '.fld'];

export const SIM_ACCEPT_ATTR = '.json,.csv,.vtk,.sim,.fld,application/json,text/csv,text/plain';

export const SIM_FORMATS_LABEL = '.json, .csv, .vtk, .sim';

export const SIM_FORMATS_HINT =
  'Simulation scalar fields from JSON, CSV, VTK ASCII structured points, or .sim. Browse fields, slices, and probes locally. Education/research only.';

export const SIM_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const SIM_RELATED_TOOLS: ReadonlyArray<SimulationRelatedToolLink> = [
  { label: 'Climate Data Viewer', description: 'Climate maps and time series', path: '/science-viewers/climate-data-viewer' },
  { label: 'HDF5 Viewer', description: 'Hierarchical scientific datasets', path: '/science-viewers/hdf5-viewer' },
  { label: 'NetCDF Viewer', description: 'NetCDF classic grids', path: '/science-viewers/netcdf-viewer' },
  { label: 'MATLAB MAT Viewer', description: 'MATLAB array exploration', path: '/science-viewers/matlab-mat-viewer' }
];
