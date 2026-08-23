import type { SkRelatedToolLink } from '../types/sketchup-viewer.types';

export const SK_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.skp', '.txt', '.json', '.csv', '.md'];

export const SK_ACCEPT_ATTR =
  '.skp,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const SK_FORMATS_LABEL = '.skp, .json, .csv, .md, .txt';

export const SK_FORMATS_HINT = 'SketchUp groups and components. Education/research only.';

export const SK_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const SK_RELATED_TOOLS: ReadonlyArray<SkRelatedToolLink> = [
  { label: 'Rhino 3DM Viewer', description: 'Rhinoceros freeform models', path: '/cad-viewers/rhino-3dm-viewer' },
  { label: 'Fusion 360 Viewer', description: 'Autodesk Fusion designs', path: '/cad-viewers/fusion-360-viewer' },
  { label: 'DWG Viewer', description: 'AutoCAD drawings', path: '/cad-viewers/dwg-viewer' },
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' }
];
