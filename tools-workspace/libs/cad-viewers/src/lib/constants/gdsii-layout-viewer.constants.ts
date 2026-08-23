import type { GdRelatedToolLink } from '../types/gdsii-layout-viewer.types';

export const GD_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.gds', '.gdsii', '.txt', '.json', '.csv', '.md'];

export const GD_ACCEPT_ATTR =
  '.gds,.gdsii,.txt,.json,.csv,.md,application/x-gdsii,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const GD_FORMATS_LABEL = '.gds, .gdsii, .json, .csv, .md, .txt';

export const GD_FORMATS_HINT = 'GDSII semiconductor layers and cells. Education/research only.';

export const GD_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const GD_RELATED_TOOLS: ReadonlyArray<GdRelatedToolLink> = [
  { label: 'Gerber File Viewer', description: 'PCB fabrication artwork', path: '/cad-viewers/gerber-file-viewer' },
  { label: 'KiCad Viewer', description: 'Open-source EDA', path: '/cad-viewers/kicad-viewer' },
  { label: 'Altium PCB Viewer', description: 'Professional PCB review', path: '/cad-viewers/altium-pcb-viewer' },
  { label: 'DXF Viewer', description: 'ASCII CAD drawings', path: '/cad-viewers/dxf-viewer' }
];
