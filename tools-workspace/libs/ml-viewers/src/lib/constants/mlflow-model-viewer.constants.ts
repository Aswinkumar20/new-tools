import type { MfRelatedToolLink } from '../types/mlflow-model-viewer.types';

export const MF_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.mlmodel', '.yaml', '.yml', '.zip', '.txt', '.json', '.csv', '.md'];

export const MF_ACCEPT_ATTR =
  '.mlmodel,.yaml,.yml,.zip,.txt,.json,.csv,.md,application/octet-stream,application/json,application/zip,text/plain,text/yaml,text/csv,text/markdown';

export const MF_FORMATS_LABEL = '.mlmodel, .yaml, .zip, .json, .csv, .md, .txt';

export const MF_FORMATS_HINT = 'MLflow signatures, flavors, and artifact files. Education/research only.';

export const MF_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const MF_RELATED_TOOLS: ReadonlyArray<MfRelatedToolLink> = [
  { label: 'Keras Model Viewer', description: 'Keras layers and shapes', path: '/ml-viewers/keras-model-viewer' },
  { label: 'ONNX Viewer', description: 'ONNX ops and tensors', path: '/ml-viewers/onnx-viewer' },
  { label: 'Model Architecture Viewer', description: 'Architecture summaries', path: '/ml-viewers/model-architecture-viewer' },
  { label: 'Pickle Viewer', description: 'Safe pickle metadata peek', path: '/ml-viewers/pickle-viewer' }
];
