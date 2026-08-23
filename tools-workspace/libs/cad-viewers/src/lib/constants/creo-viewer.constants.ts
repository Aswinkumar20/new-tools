import type { CrRelatedToolLink } from '../types/creo-viewer.types';

export const CR_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.prt', '.asm', '.txt', '.json', '.csv', '.md'];

export const CR_ACCEPT_ATTR =
  '.prt,.asm,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const CR_FORMATS_LABEL = '.prt, .asm, .json, .csv, .md, .txt';

export const CR_FORMATS_HINT = 'Creo parts and assemblies. Education/research only.';

export const CR_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const CR_RELATED_TOOLS: ReadonlyArray<CrRelatedToolLink> = [
  { label: 'Inventor Viewer', description: 'Autodesk Inventor models', path: '/cad-viewers/inventor-viewer' },
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' },
  { label: 'SolidWorks Viewer', description: 'SolidWorks parts', path: '/cad-viewers/solidworks-viewer' },
  { label: 'CATIA Viewer', description: 'Dassault CATIA parts', path: '/cad-viewers/catia-viewer' }
];
