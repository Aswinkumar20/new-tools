import type { IgRelatedToolLink } from '../types/iges-viewer.types';

export const IG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.iges', '.igs', '.txt', '.json', '.csv', '.md'];

export const IG_ACCEPT_ATTR =
  '.iges,.igs,.txt,.json,.csv,.md,application/octet-stream,model/iges,application/json,text/plain,text/csv,text/markdown';

export const IG_FORMATS_LABEL = '.iges, .igs, .json, .csv, .md, .txt';

export const IG_FORMATS_HINT = 'IGES surfaces and entities. Education/research only.';

export const IG_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const IG_RELATED_TOOLS: ReadonlyArray<IgRelatedToolLink> = [
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' },
  { label: 'DWG Viewer', description: 'AutoCAD drawings', path: '/cad-viewers/dwg-viewer' },
  { label: 'DXF Viewer', description: 'Open CAD exchange drawings', path: '/cad-viewers/dxf-viewer' },
  { label: 'Parasolid Viewer', description: 'Industrial CAD kernel solids', path: '/cad-viewers/parasolid-viewer' }
];
