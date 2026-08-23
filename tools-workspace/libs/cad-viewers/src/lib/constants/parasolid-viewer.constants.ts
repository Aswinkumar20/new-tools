import type { PxRelatedToolLink } from '../types/parasolid-viewer.types';

export const PX_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.x_t', '.x_b', '.xt', '.xb', '.txt', '.json', '.csv', '.md'];

export const PX_ACCEPT_ATTR =
  '.x_t,.x_b,.xt,.xb,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const PX_FORMATS_LABEL = '.x_t, .x_b, .json, .csv, .md, .txt';

export const PX_FORMATS_HINT = 'Parasolid XT solids and measurements. Education/research only.';

export const PX_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const PX_RELATED_TOOLS: ReadonlyArray<PxRelatedToolLink> = [
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' },
  { label: 'IGES Viewer', description: 'Legacy surface CAD', path: '/cad-viewers/iges-viewer' },
  { label: 'CATIA Viewer', description: 'Dassault CATIA parts', path: '/cad-viewers/catia-viewer' },
  { label: 'SolidWorks Viewer', description: 'SolidWorks parts', path: '/cad-viewers/solidworks-viewer' }
];
