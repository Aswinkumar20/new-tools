import type { BoreholeRelatedToolLink } from '../types/borehole-viewer.types';

export const BOREHOLE_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.csv', '.bhl', '.dev'];

export const BOREHOLE_ACCEPT_ATTR = '.json,.csv,.bhl,.dev,application/json,text/csv,text/plain';

export const BOREHOLE_FORMATS_LABEL = '.json, .csv, .bhl, .dev';

export const BOREHOLE_FORMATS_HINT =
  'Borehole trajectories stay in your browser. Plan, section, lithology, and dogleg previews are for education/research only.';

export const BOREHOLE_MAX_FILE_BYTES = 8 * 1024 * 1024;

export const BOREHOLE_RELATED_TOOLS: ReadonlyArray<BoreholeRelatedToolLink> = [
  { label: 'LAS Well Log Viewer', description: 'CWLS LAS depth tracks', path: '/science-viewers/las-well-log-viewer' },
  { label: 'DLIS Viewer', description: 'Digital log interchange', path: '/science-viewers/dlis-viewer' },
  { label: 'Geological Model Viewer', description: 'Layers and cross-sections', path: '/science-viewers/geological-model-viewer' },
  { label: 'Stratigraphy Viewer', description: 'Stratigraphic columns', path: '/science-viewers/stratigraphy-viewer' }
];
