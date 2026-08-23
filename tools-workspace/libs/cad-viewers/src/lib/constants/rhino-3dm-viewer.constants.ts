import type { RhRelatedToolLink } from '../types/rhino-3dm-viewer.types';

export const RH_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.3dm', '.txt', '.json', '.csv', '.md'];

export const RH_ACCEPT_ATTR =
  '.3dm,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const RH_FORMATS_LABEL = '.3dm, .json, .csv, .md, .txt';

export const RH_FORMATS_HINT = 'Rhino surfaces and layers. Education/research only.';

export const RH_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const RH_RELATED_TOOLS: ReadonlyArray<RhRelatedToolLink> = [
  { label: 'SketchUp Viewer', description: 'Architecture concept models', path: '/cad-viewers/sketchup-viewer' },
  { label: 'IGES Viewer', description: 'Legacy surface CAD', path: '/cad-viewers/iges-viewer' },
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' },
  { label: 'Fusion 360 Viewer', description: 'Autodesk Fusion designs', path: '/cad-viewers/fusion-360-viewer' }
];
