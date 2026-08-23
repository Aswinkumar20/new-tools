import type { RvRelatedToolLink } from '../types/revit-viewer.types';

export const RV_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.rvt', '.rfa', '.txt', '.json', '.csv', '.md'];

export const RV_ACCEPT_ATTR =
  '.rvt,.rfa,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const RV_FORMATS_LABEL = '.rvt, .rfa, .json, .csv, .md, .txt';

export const RV_FORMATS_HINT = 'Revit BIM navigate and families. Education/research only.';

export const RV_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const RV_RELATED_TOOLS: ReadonlyArray<RvRelatedToolLink> = [
  { label: 'IFC Viewer', description: 'OpenBIM building models', path: '/cad-viewers/ifc-viewer' },
  { label: 'Navisworks Viewer', description: 'AEC coordination', path: '/cad-viewers/navisworks-viewer' },
  { label: 'BIM Clash Viewer', description: 'Clash detection review', path: '/cad-viewers/bim-clash-viewer' },
  { label: 'Inventor Viewer', description: 'Autodesk Inventor models', path: '/cad-viewers/inventor-viewer' }
];
