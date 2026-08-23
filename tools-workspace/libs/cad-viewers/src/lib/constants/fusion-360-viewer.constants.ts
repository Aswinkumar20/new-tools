import type { FuRelatedToolLink } from '../types/fusion-360-viewer.types';

export const FU_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.f3d', '.txt', '.json', '.csv', '.md'];

export const FU_ACCEPT_ATTR =
  '.f3d,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const FU_FORMATS_LABEL = '.f3d, .json, .csv, .md, .txt';

export const FU_FORMATS_HINT = 'Fusion 360 bodies and components. Education/research only.';

export const FU_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const FU_RELATED_TOOLS: ReadonlyArray<FuRelatedToolLink> = [
  { label: 'SolidWorks Viewer', description: 'SolidWorks parts', path: '/cad-viewers/solidworks-viewer' },
  { label: 'Inventor Viewer', description: 'Autodesk Inventor models', path: '/cad-viewers/inventor-viewer' },
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' },
  { label: 'Rhino 3DM Viewer', description: 'Rhinoceros freeform models', path: '/cad-viewers/rhino-3dm-viewer' }
];
