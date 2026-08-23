import type { NwRelatedToolLink } from '../types/navisworks-viewer.types';

export const NW_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.nwd', '.nwf', '.nwc', '.txt', '.json', '.csv', '.md'];

export const NW_ACCEPT_ATTR =
  '.nwd,.nwf,.nwc,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const NW_FORMATS_LABEL = '.nwd, .nwf, .nwc, .json, .csv, .md, .txt';

export const NW_FORMATS_HINT = 'Navisworks coordination, clash context, and 3D navigate. Education/research only.';

export const NW_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const NW_RELATED_TOOLS: ReadonlyArray<NwRelatedToolLink> = [
  { label: 'BIM Clash Viewer', description: 'Clash list and 3D focus', path: '/cad-viewers/bim-clash-viewer' },
  { label: 'IFC Viewer', description: 'OpenBIM building models', path: '/cad-viewers/ifc-viewer' },
  { label: 'Revit Viewer', description: 'Autodesk Revit preview', path: '/cad-viewers/revit-viewer' },
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' }
];
