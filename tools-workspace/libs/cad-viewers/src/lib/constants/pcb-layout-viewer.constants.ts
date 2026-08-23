import type { PbRelatedToolLink } from '../types/pcb-layout-viewer.types';

export const PB_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pcb', '.txt', '.json', '.csv', '.md'];

export const PB_ACCEPT_ATTR =
  '.pcb,.txt,.json,.csv,.md,application/x-pcb,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const PB_FORMATS_LABEL = '.pcb, .json, .csv, .md, .txt';

export const PB_FORMATS_HINT = 'PCB layer stack and nets. Education/research only.';

export const PB_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const PB_RELATED_TOOLS: ReadonlyArray<PbRelatedToolLink> = [
  { label: 'Gerber File Viewer', description: 'PCB fabrication artwork', path: '/cad-viewers/gerber-file-viewer' },
  { label: 'KiCad Viewer', description: 'Open-source EDA', path: '/cad-viewers/kicad-viewer' },
  { label: 'Eagle PCB Viewer', description: 'Legacy Eagle boards', path: '/cad-viewers/eagle-pcb-viewer' },
  { label: 'Altium PCB Viewer', description: 'Professional PCB review', path: '/cad-viewers/altium-pcb-viewer' }
];
