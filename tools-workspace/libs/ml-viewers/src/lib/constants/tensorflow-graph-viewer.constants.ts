import type { TfRelatedToolLink } from '../types/tensorflow-graph-viewer.types';

export const TF_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pb', '.pbtxt', '.graphdef', '.txt', '.json', '.csv', '.md'];

export const TF_ACCEPT_ATTR =
  '.pb,.pbtxt,.graphdef,.txt,.json,.csv,.md,application/octet-stream,text/plain,application/json,text/csv,text/markdown';

export const TF_FORMATS_LABEL = '.pb, .pbtxt, .graphdef, .json, .csv, .md, .txt';

export const TF_FORMATS_HINT = 'TensorFlow GraphDef nodes and tensors. Education/research only.';

export const TF_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const TF_RELATED_TOOLS: ReadonlyArray<TfRelatedToolLink> = [
  { label: 'ONNX Viewer', description: 'ONNX ops and tensors', path: '/ml-viewers/onnx-viewer' },
  { label: 'PyTorch Model Viewer', description: 'PyTorch layers and params', path: '/ml-viewers/pytorch-model-viewer' },
  { label: 'Keras Model Viewer', description: 'Keras layers and shapes', path: '/ml-viewers/keras-model-viewer' },
  { label: 'Neural Network Graph Viewer', description: 'Generic NN graphs', path: '/ml-viewers/neural-network-graph-viewer' }
];
