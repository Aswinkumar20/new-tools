import type { PtRelatedToolLink } from '../types/pytorch-model-viewer.types';

export const PT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pt', '.pth', '.bin', '.txt', '.json', '.csv', '.md'];

export const PT_ACCEPT_ATTR =
  '.pt,.pth,.bin,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const PT_FORMATS_LABEL = '.pt, .pth, .json, .csv, .md, .txt';

export const PT_FORMATS_HINT = 'PyTorch layers, params, and checkpoint metadata. Education/research only.';

export const PT_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const PT_RELATED_TOOLS: ReadonlyArray<PtRelatedToolLink> = [
  { label: 'ONNX Viewer', description: 'ONNX ops and tensors', path: '/ml-viewers/onnx-viewer' },
  { label: 'TensorFlow Graph Viewer', description: 'TF graphs and tensors', path: '/ml-viewers/tensorflow-graph-viewer' },
  { label: 'Keras Model Viewer', description: 'Keras layers and shapes', path: '/ml-viewers/keras-model-viewer' },
  { label: 'Model Architecture Viewer', description: 'Architecture summaries', path: '/ml-viewers/model-architecture-viewer' }
];
