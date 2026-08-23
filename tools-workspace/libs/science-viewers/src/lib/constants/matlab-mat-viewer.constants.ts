import type { MatRelatedToolLink } from '../types/matlab-mat-viewer.types';
import { MAT_SAMPLE_BASE64 } from './mat-sample.data';

export const MAT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.mat'];

export const MAT_ACCEPT_ATTR = '.mat,application/matlab,application/x-matlab-data';

export const MAT_FORMATS_LABEL = '.mat (MAT v5 / v7.3)';

export const MAT_FORMATS_HINT =
  'MATLAB MAT v5 numeric arrays and v7.3 HDF5-based files. Compressed v5 variables and structs/cells may show warnings. Education/research only.';

export const MAT_MAX_FILE_BYTES = 25 * 1024 * 1024;

export { MAT_SAMPLE_BASE64 };

export const MAT_RELATED_TOOLS: ReadonlyArray<MatRelatedToolLink> = [
  { label: 'HDF5 Viewer', description: 'HDF5 datasets (MAT v7.3 internals)', path: '/science-viewers/hdf5-viewer' },
  { label: 'ROOT File Viewer', description: 'HEP histograms and trees', path: '/science-viewers/root-file-viewer' },
  { label: 'Molecular Structure Viewer', description: 'PDB / MOL / SDF preview', path: '/science-viewers/molecular-structure-viewer' }
];
