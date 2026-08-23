import type { DgRelatedToolLink } from '../types/dgn-viewer.types';

export const DG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.dgn', '.txt', '.json', '.csv', '.md'];

export const DG_ACCEPT_ATTR =
  '.dgn,.txt,.json,.csv,.md,application/octet-stream,image/vnd.dgn,application/json,text/plain,text/csv,text/markdown';

export const DG_FORMATS_LABEL = '.dgn, .json, .csv, .md, .txt';

export const DG_FORMATS_HINT = 'MicroStation DGN levels and civil features. Education/research only.';

export const DG_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const DG_RELATED_TOOLS: ReadonlyArray<DgRelatedToolLink> = [
  { label: 'DWG Viewer', description: 'AutoCAD drawings', path: '/cad-viewers/dwg-viewer' },
  { label: 'DXF Viewer', description: 'Open CAD exchange drawings', path: '/cad-viewers/dxf-viewer' },
  { label: 'DWF Viewer', description: 'Design Web Format preview', path: '/cad-viewers/dwf-viewer' },
  { label: 'Building Floor Plan Viewer', description: 'Floor-plan BIM views', path: '/cad-viewers/building-floor-plan-viewer' }
];
