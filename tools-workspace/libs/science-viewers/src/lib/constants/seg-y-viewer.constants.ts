import type { SegyRelatedToolLink } from '../types/seg-y-viewer.types';

export const SEGY_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.sgy', '.segy'];

export const SEGY_ACCEPT_ATTR = '.sgy,.segy,application/octet-stream';

export const SEGY_FORMATS_LABEL = '.sgy, .segy (SEG-Y)';

export const SEGY_FORMATS_HINT =
  'SEG-Y seismic volumes stay in your browser. Section, wiggle, gain, and AGC previews are for education/research only.';

export const SEGY_MAX_FILE_BYTES = 40 * 1024 * 1024;
export const SEGY_MAX_TRACES = 600;
export const SEGY_MAX_SAMPLES = 3000;

export const SEGY_RELATED_TOOLS: ReadonlyArray<SegyRelatedToolLink> = [
  { label: 'Geological Model Viewer', description: 'Layers and cross-sections', path: '/science-viewers/geological-model-viewer' },
  { label: 'LAS Well Log Viewer', description: 'CWLS LAS depth tracks', path: '/science-viewers/las-well-log-viewer' },
  { label: 'DLIS Viewer', description: 'Digital log interchange', path: '/science-viewers/dlis-viewer' }
];
