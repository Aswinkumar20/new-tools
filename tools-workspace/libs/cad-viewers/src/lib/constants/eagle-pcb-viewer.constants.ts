import type { EgRelatedToolLink } from '../types/eagle-pcb-viewer.types';

export const EG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.brd', '.sch', '.txt', '.json', '.csv', '.md'];

export const EG_ACCEPT_ATTR =
  '.brd,.sch,.txt,.json,.csv,.md,application/x-eagle,application/xml,application/octet-stream,application/json,text/plain,text/csv,text/markdown,text/xml';

export const EG_FORMATS_LABEL = '.brd, .sch, .json, .csv, .md, .txt';

export const EG_FORMATS_HINT = 'Eagle board and schematic. Education/research only.';

export const EG_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const EG_RELATED_TOOLS: ReadonlyArray<EgRelatedToolLink> = [
  { label: 'KiCad Viewer', description: 'Open-source EDA', path: '/cad-viewers/kicad-viewer' },
  { label: 'PCB Layout Viewer', description: 'Board stack and nets', path: '/cad-viewers/pcb-layout-viewer' },
  { label: 'Gerber File Viewer', description: 'PCB fabrication artwork', path: '/cad-viewers/gerber-file-viewer' },
  { label: 'Altium PCB Viewer', description: 'Professional PCB review', path: '/cad-viewers/altium-pcb-viewer' }
];
