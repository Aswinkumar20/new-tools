import type { AlRelatedToolLink } from '../types/altium-pcb-viewer.types';

export const AL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pcbdoc', '.schdoc', '.prjpcb', '.txt', '.json', '.csv', '.md'];

export const AL_ACCEPT_ATTR =
  '.pcbdoc,.schdoc,.prjpcb,.txt,.json,.csv,.md,application/x-altium,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const AL_FORMATS_LABEL = '.pcbdoc, .schdoc, .json, .csv, .md, .txt';

export const AL_FORMATS_HINT = 'Altium copper layers and designators. Education/research only.';

export const AL_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const AL_RELATED_TOOLS: ReadonlyArray<AlRelatedToolLink> = [
  { label: 'KiCad Viewer', description: 'Open-source EDA', path: '/cad-viewers/kicad-viewer' },
  { label: 'Eagle PCB Viewer', description: 'Legacy Eagle boards', path: '/cad-viewers/eagle-pcb-viewer' },
  { label: 'PCB Layout Viewer', description: 'Board stack and nets', path: '/cad-viewers/pcb-layout-viewer' },
  { label: 'Gerber File Viewer', description: 'PCB fabrication artwork', path: '/cad-viewers/gerber-file-viewer' }
];
