import type { PkRelatedToolLink } from '../types/pickle-viewer.types';

export const PK_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pkl', '.pickle', '.p', '.joblib', '.txt', '.json', '.csv', '.md'];

export const PK_ACCEPT_ATTR =
  '.pkl,.pickle,.p,.joblib,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const PK_FORMATS_LABEL = '.pkl, .pickle, .json, .csv, .md, .txt';

export const PK_FORMATS_HINT = 'Safe pickle type hints and warnings. Education/research only.';

export const PK_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const PK_RELATED_TOOLS: ReadonlyArray<PkRelatedToolLink> = [
  { label: 'Tensor Visualization Viewer', description: 'Tensor shapes and stats', path: '/ml-viewers/tensor-visualization-viewer' },
  { label: 'PyTorch Model Viewer', description: 'PyTorch layers and params', path: '/ml-viewers/pytorch-model-viewer' },
  { label: 'Keras Model Viewer', description: 'Keras layers and shapes', path: '/ml-viewers/keras-model-viewer' },
  { label: 'ONNX Viewer', description: 'ONNX ops and tensors', path: '/ml-viewers/onnx-viewer' }
];
