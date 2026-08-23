import type { GbRelatedToolLink } from '../types/gerber-file-viewer.types';

export const GB_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.gbr', '.ger', '.txt', '.json', '.csv', '.md'];

export const GB_ACCEPT_ATTR =
  '.gbr,.ger,.txt,.json,.csv,.md,application/vnd.gerber,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const GB_FORMATS_LABEL = '.gbr, .ger, .json, .csv, .md, .txt';

export const GB_FORMATS_HINT = 'Gerber copper / silk / mask artwork. Education/research only.';

export const GB_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const GB_RELATED_TOOLS: ReadonlyArray<GbRelatedToolLink> = [
  { label: 'PCB Layout Viewer', description: 'Board stack and nets', path: '/cad-viewers/pcb-layout-viewer' },
  { label: 'KiCad Viewer', description: 'Open-source EDA', path: '/cad-viewers/kicad-viewer' },
  { label: 'HPGL Viewer', description: 'Plotter language', path: '/cad-viewers/hpgl-viewer' },
  { label: 'DXF Viewer', description: 'ASCII CAD drawings', path: '/cad-viewers/dxf-viewer' }
];
