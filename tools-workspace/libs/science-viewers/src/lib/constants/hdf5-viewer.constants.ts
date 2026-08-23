import type { Hdf5RelatedToolLink } from '../types/hdf5-viewer.types';
import { HDF5_SAMPLE_BASE64 } from './hdf5-sample.data';

export const HDF5_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.h5', '.hdf5', '.he5'];

export const HDF5_ACCEPT_ATTR = '.h5,.hdf5,.he5,application/x-hdf,application/x-hdf5';

export const HDF5_FORMATS_LABEL = '.h5, .hdf5';

export const HDF5_FORMATS_HINT =
  'HDF5 hierarchical datasets with group tree navigation and numeric array preview. Compressed or compound types may have limited support. Education/research only.';

export const HDF5_MAX_FILE_BYTES = 40 * 1024 * 1024;

export { HDF5_SAMPLE_BASE64 };

export const HDF5_RELATED_TOOLS: ReadonlyArray<Hdf5RelatedToolLink> = [
  { label: 'NetCDF Viewer', description: 'NetCDF classic climate grids', path: '/science-viewers/netcdf-viewer' },
  { label: 'MATLAB MAT Viewer', description: 'MATLAB array exploration', path: '/science-viewers/matlab-mat-viewer' },
  { label: 'Simulation Result Viewer', description: 'Simulation output fields', path: '/science-viewers/simulation-result-viewer' }
];
