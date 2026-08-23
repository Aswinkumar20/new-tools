import type { DwRelatedToolLink } from '../types/dwg-viewer.types';

export const DW_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.dwg', '.txt', '.json', '.csv', '.md'];

export const DW_ACCEPT_ATTR =
  '.dwg,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const DW_FORMATS_LABEL = '.dwg, .json, .csv, .md, .txt';

export const DW_FORMATS_HINT = 'AutoCAD DWG layers, entities, and measurements. Education/research only.';

export const DW_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const DW_RELATED_TOOLS: ReadonlyArray<DwRelatedToolLink> = [
  { label: 'DXF Viewer', description: 'Open CAD exchange drawings', path: '/cad-viewers/dxf-viewer' },
  { label: 'DWF Viewer', description: 'Design Web Format preview', path: '/cad-viewers/dwf-viewer' },
  { label: 'DGN Viewer', description: 'MicroStation drawings', path: '/cad-viewers/dgn-viewer' },
  { label: 'Building Floor Plan Viewer', description: 'Floor-plan BIM views', path: '/cad-viewers/building-floor-plan-viewer' }
];
