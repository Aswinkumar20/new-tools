import type { TvRelatedToolLink } from '../types/tensor-visualization-viewer.types';

export const TV_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.tensor',
  '.tensors',
  '.npy',
  '.npz',
  '.txt',
  '.json',
  '.csv',
  '.md'
];

export const TV_ACCEPT_ATTR =
  '.tensor,.tensors,.npy,.npz,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const TV_FORMATS_LABEL = '.tensor, .npy, .npz, .json, .csv, .md, .txt';

export const TV_FORMATS_HINT = 'Tensor shapes, dtypes, and dump statistics. Education/research only.';

export const TV_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const TV_RELATED_TOOLS: ReadonlyArray<TvRelatedToolLink> = [
  { label: 'Model Architecture Viewer', description: 'Architecture summaries', path: '/ml-viewers/model-architecture-viewer' },
  { label: 'Keras Model Viewer', description: 'Keras layers and shapes', path: '/ml-viewers/keras-model-viewer' },
  { label: 'PyTorch Model Viewer', description: 'PyTorch layers and params', path: '/ml-viewers/pytorch-model-viewer' },
  { label: 'Pickle Viewer', description: 'Safe pickle type hints', path: '/ml-viewers/pickle-viewer' }
];
