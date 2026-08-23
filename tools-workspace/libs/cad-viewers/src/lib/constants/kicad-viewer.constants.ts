import type { KcRelatedToolLink } from '../types/kicad-viewer.types';

export const KC_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.kicad_pcb', '.kicad_sch', '.kicad_pro', '.txt', '.json', '.csv', '.md'];

export const KC_ACCEPT_ATTR =
  '.kicad_pcb,.kicad_sch,.kicad_pro,.txt,.json,.csv,.md,application/x-kicad,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const KC_FORMATS_LABEL = '.kicad_pcb, .kicad_sch, .json, .csv, .md, .txt';

export const KC_FORMATS_HINT = 'KiCad board and schematic. Education/research only.';

export const KC_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const KC_RELATED_TOOLS: ReadonlyArray<KcRelatedToolLink> = [
  { label: 'PCB Layout Viewer', description: 'Board stack and nets', path: '/cad-viewers/pcb-layout-viewer' },
  { label: 'Gerber File Viewer', description: 'PCB fabrication artwork', path: '/cad-viewers/gerber-file-viewer' },
  { label: 'Eagle PCB Viewer', description: 'Legacy Eagle boards', path: '/cad-viewers/eagle-pcb-viewer' },
  { label: 'Altium PCB Viewer', description: 'Professional PCB review', path: '/cad-viewers/altium-pcb-viewer' }
];
