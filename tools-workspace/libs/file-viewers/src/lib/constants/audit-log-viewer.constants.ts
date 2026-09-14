import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const AUDIT_LOG_TITLE = 'Audit Log Viewer';
export const AUDIT_LOG_DESCRIPTION =
  'Browse enterprise audit exports with actor filters, search, and timeline review.';
export const AUDIT_LOG_ACCEPT_ATTR = '.json,.jsonl,.csv,.txt,application/json,text/csv,text/plain';
export const AUDIT_LOG_FORMATS_LABEL = 'JSON, JSONL, CSV';

export const AUDIT_LOG_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Log Viewer',
    path: '/file-viewers/log-viewer',
    description: 'Parse unstructured application logs'
  },
  {
    label: 'Text File Viewer',
    path: '/file-viewers/text-file-viewer',
    description: 'Read raw audit text exports'
  }
];

export const AUDIT_LOG_HELP_ITEMS = [
  'Upload JSON, JSONL, or CSV audit exports.',
  'Filter by actor and search actions.',
  'Review events in chronological order.'
] as const;
