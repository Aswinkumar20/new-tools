import type { DlisRelatedToolLink } from '../types/dlis-viewer.types';

export const DLIS_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.dlis'];

export const DLIS_ACCEPT_ATTR = '.dlis,application/octet-stream';

export const DLIS_FORMATS_LABEL = '.dlis (RP66)';

export const DLIS_FORMATS_HINT =
  'DLIS storage-unit labels, records, and channel previews stay in your browser. Encrypted or full RP66 templates may show warnings. Education/research only.';

export const DLIS_MAX_FILE_BYTES = 30 * 1024 * 1024;

export const DLIS_RELATED_TOOLS: ReadonlyArray<DlisRelatedToolLink> = [
  { label: 'LAS Well Log Viewer', description: 'CWLS LAS depth tracks', path: '/science-viewers/las-well-log-viewer' },
  { label: 'SEG-Y Viewer', description: 'Seismic sections', path: '/science-viewers/seg-y-viewer' },
  { label: 'Borehole Viewer', description: 'Well / borehole paths', path: '/science-viewers/borehole-viewer' }
];
