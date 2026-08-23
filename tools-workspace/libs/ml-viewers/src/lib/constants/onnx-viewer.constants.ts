import type { OxRelatedToolLink } from '../types/onnx-viewer.types';

export const OX_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.onnx', '.txt', '.json', '.csv', '.md'];

export const OX_ACCEPT_ATTR =
  '.onnx,.txt,.json,.csv,.md,application/octet-stream,application/onnx,application/json,text/plain,text/csv,text/markdown';

export const OX_FORMATS_LABEL = '.onnx, .json, .csv, .md, .txt';

export const OX_FORMATS_HINT = 'ONNX ops graph, tensors, and metadata. Education/research only.';

export const OX_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const OX_RELATED_TOOLS: ReadonlyArray<OxRelatedToolLink> = [
  { label: 'TensorFlow Graph Viewer', description: 'TF graphs and tensors', path: '/ml-viewers/tensorflow-graph-viewer' },
  { label: 'PyTorch Model Viewer', description: 'PyTorch modules', path: '/ml-viewers/pytorch-model-viewer' },
  { label: 'Keras Model Viewer', description: 'Keras layers and shapes', path: '/ml-viewers/keras-model-viewer' },
  { label: 'Neural Network Graph Viewer', description: 'Generic NN graphs', path: '/ml-viewers/neural-network-graph-viewer' }
];
