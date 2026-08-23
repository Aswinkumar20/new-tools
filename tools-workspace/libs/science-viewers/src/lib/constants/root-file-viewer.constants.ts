import type { RootRelatedToolLink } from '../types/root-file-viewer.types';
import { ROOT_SAMPLE_BASE64 } from './root-sample.data';

export const ROOT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.root'];

export const ROOT_ACCEPT_ATTR = '.root,application/octet-stream';

export const ROOT_FORMATS_LABEL = '.root (ROOT 6+)';

export const ROOT_FORMATS_HINT =
  'Browse ROOT histograms and tree metadata locally. Compressed streamer-dependent objects may show soft warnings. Education/research only.';

export const ROOT_MAX_FILE_BYTES = 25 * 1024 * 1024;

export { ROOT_SAMPLE_BASE64 };

export const ROOT_RELATED_TOOLS: ReadonlyArray<RootRelatedToolLink> = [
  { label: 'MATLAB MAT Viewer', description: 'MATLAB array exploration', path: '/science-viewers/matlab-mat-viewer' },
  { label: 'HDF5 Viewer', description: 'Hierarchical scientific datasets', path: '/science-viewers/hdf5-viewer' },
  { label: 'Simulation Result Viewer', description: 'Simulation field plots', path: '/science-viewers/simulation-result-viewer' }
];
