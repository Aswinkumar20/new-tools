import type { MaRelatedToolLink } from '../types/model-architecture-viewer.types';

export const MA_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.arch', '.spec', '.txt', '.json', '.csv', '.md'];

export const MA_ACCEPT_ATTR =
  '.arch,.spec,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const MA_FORMATS_LABEL = '.arch, .spec, .json, .csv, .md, .txt';

export const MA_FORMATS_HINT = 'Model architecture blocks and parameter summaries. Education/research only.';

export const MA_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const MA_RELATED_TOOLS: ReadonlyArray<MaRelatedToolLink> = [
  { label: 'Neural Network Graph Viewer', description: 'Generic NN graphs', path: '/ml-viewers/neural-network-graph-viewer' },
  { label: 'Keras Model Viewer', description: 'Keras layers and shapes', path: '/ml-viewers/keras-model-viewer' },
  { label: 'PyTorch Model Viewer', description: 'PyTorch layers and params', path: '/ml-viewers/pytorch-model-viewer' },
  { label: 'Tensor Visualization Viewer', description: 'Tensor shapes and stats', path: '/ml-viewers/tensor-visualization-viewer' }
];
