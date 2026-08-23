import type { LasRelatedToolLink } from '../types/las-well-log-viewer.types';
import { LAS_SAMPLE } from './las-sample.data';

export const LAS_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.las'];

export const LAS_ACCEPT_ATTR = '.las,application/octet-stream,text/plain';

export const LAS_FORMATS_LABEL = '.las (CWLS well log)';

export const LAS_FORMATS_HINT =
  'CWLS LAS 2.0 well logs stay in your browser. Depth tracks, crossplots, and curve stats are for education/research only.';

export const LAS_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const LAS_MAX_ROWS = 20_000;

export { LAS_SAMPLE };

export const LAS_CURVE_COLORS: Record<string, string> = {
  DEPT: '#94a3b8',
  DEPTH: '#94a3b8',
  GR: '#22c55e',
  GAMMA: '#22c55e',
  RHOB: '#ef4444',
  DEN: '#ef4444',
  NPHI: '#38bdf8',
  NEUT: '#38bdf8',
  DT: '#a855f7',
  AC: '#a855f7',
  RES: '#f59e0b',
  ILD: '#f59e0b',
  SP: '#14b8a6',
  CALI: '#fb923c'
};

export const LAS_RELATED_TOOLS: ReadonlyArray<LasRelatedToolLink> = [
  { label: 'DLIS Viewer', description: 'Digital log interchange', path: '/science-viewers/dlis-viewer' },
  { label: 'SEG-Y Viewer', description: 'Seismic sections', path: '/science-viewers/seg-y-viewer' },
  { label: 'Borehole Viewer', description: 'Well / borehole paths', path: '/science-viewers/borehole-viewer' }
];
