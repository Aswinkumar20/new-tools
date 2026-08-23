import type { StratigraphyRelatedToolLink } from '../types/stratigraphy-viewer.types';

export const STRAT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.csv', '.str'];

export const STRAT_ACCEPT_ATTR = '.json,.csv,.str,application/json,text/csv,text/plain';

export const STRAT_FORMATS_LABEL = '.json, .csv, .str';

export const STRAT_FORMATS_HINT =
  'Stratigraphic columns stay in your browser. Thickness, chronostratigraphy, and correlation previews are for education/research only.';

export const STRAT_MAX_FILE_BYTES = 8 * 1024 * 1024;

export const STRAT_RELATED_TOOLS: ReadonlyArray<StratigraphyRelatedToolLink> = [
  { label: 'Geological Model Viewer', description: 'Layers and cross-sections', path: '/science-viewers/geological-model-viewer' },
  { label: 'Borehole Viewer', description: 'Well / borehole paths', path: '/science-viewers/borehole-viewer' },
  { label: 'LAS Well Log Viewer', description: 'CWLS LAS depth tracks', path: '/science-viewers/las-well-log-viewer' }
];
