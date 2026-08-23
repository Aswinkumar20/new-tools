import type { BcRelatedToolLink } from '../types/bim-clash-viewer.types';

export const BC_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.xml', '.ifc', '.txt', '.json', '.csv', '.md'];

export const BC_ACCEPT_ATTR =
  '.xml,.ifc,.txt,.json,.csv,.md,application/xml,text/xml,application/x-step,application/json,text/plain,text/csv,text/markdown';

export const BC_FORMATS_LABEL = '.xml, .ifc, .json, .csv, .md, .txt';

export const BC_FORMATS_HINT = 'BIM clash reports with clash list and 3D focus. Education/research only.';

export const BC_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const BC_RELATED_TOOLS: ReadonlyArray<BcRelatedToolLink> = [
  { label: 'Navisworks Viewer', description: 'AEC coordination', path: '/cad-viewers/navisworks-viewer' },
  { label: 'IFC Viewer', description: 'OpenBIM building models', path: '/cad-viewers/ifc-viewer' },
  { label: 'Revit Viewer', description: 'Autodesk Revit preview', path: '/cad-viewers/revit-viewer' },
  { label: 'MEP Model Viewer', description: 'MEP discipline review', path: '/cad-viewers/mep-model-viewer' }
];
