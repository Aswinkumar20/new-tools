import type { KsRelatedToolLink } from '../types/keras-model-viewer.types';

export const KS_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.keras', '.h5', '.hdf5', '.txt', '.json', '.csv', '.md'];

export const KS_ACCEPT_ATTR =
  '.keras,.h5,.hdf5,.txt,.json,.csv,.md,application/octet-stream,application/json,application/zip,text/plain,text/csv,text/markdown';

export const KS_FORMATS_LABEL = '.keras, .h5, .json, .csv, .md, .txt';

export const KS_FORMATS_HINT = 'Keras layers, shapes, and architecture metadata. Education/research only.';

export const KS_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const KS_RELATED_TOOLS: ReadonlyArray<KsRelatedToolLink> = [
  { label: 'ONNX Viewer', description: 'ONNX ops and tensors', path: '/ml-viewers/onnx-viewer' },
  { label: 'TensorFlow Graph Viewer', description: 'TF graphs and tensors', path: '/ml-viewers/tensorflow-graph-viewer' },
  { label: 'PyTorch Model Viewer', description: 'PyTorch layers and params', path: '/ml-viewers/pytorch-model-viewer' },
  { label: 'Model Architecture Viewer', description: 'Architecture summaries', path: '/ml-viewers/model-architecture-viewer' }
];
