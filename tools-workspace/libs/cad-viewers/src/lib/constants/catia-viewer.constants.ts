import type { CtRelatedToolLink } from '../types/catia-viewer.types';

export const CT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.catpart', '.catproduct', '.txt', '.json', '.csv', '.md'];

export const CT_ACCEPT_ATTR =
  '.catpart,.catproduct,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const CT_FORMATS_LABEL = '.catpart, .catproduct, .json, .csv, .md, .txt';

export const CT_FORMATS_HINT = 'CATIA parts and assemblies. Education/research only.';

export const CT_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const CT_RELATED_TOOLS: ReadonlyArray<CtRelatedToolLink> = [
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' },
  { label: 'Parasolid Viewer', description: 'Industrial CAD kernel solids', path: '/cad-viewers/parasolid-viewer' },
  { label: 'SolidWorks Viewer', description: 'SolidWorks parts', path: '/cad-viewers/solidworks-viewer' },
  { label: 'Inventor Viewer', description: 'Autodesk Inventor models', path: '/cad-viewers/inventor-viewer' }
];
