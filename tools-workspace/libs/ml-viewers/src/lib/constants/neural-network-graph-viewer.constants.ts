import type { NnRelatedToolLink } from '../types/neural-network-graph-viewer.types';

export const NN_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.nn', '.nngraph', '.graph', '.txt', '.json', '.csv', '.md'];

export const NN_ACCEPT_ATTR =
  '.nn,.nngraph,.graph,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const NN_FORMATS_LABEL = '.nn, .graph, .json, .csv, .md, .txt';

export const NN_FORMATS_HINT = 'Generic neural-network layers and connections. Education/research only.';

export const NN_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const NN_RELATED_TOOLS: ReadonlyArray<NnRelatedToolLink> = [
  { label: 'ONNX Viewer', description: 'ONNX ops and tensors', path: '/ml-viewers/onnx-viewer' },
  { label: 'TensorFlow Graph Viewer', description: 'TF graphs and tensors', path: '/ml-viewers/tensorflow-graph-viewer' },
  { label: 'Keras Model Viewer', description: 'Keras layers and shapes', path: '/ml-viewers/keras-model-viewer' },
  { label: 'Model Architecture Viewer', description: 'Architecture summaries', path: '/ml-viewers/model-architecture-viewer' }
];
