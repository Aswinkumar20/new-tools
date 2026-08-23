import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';
import type { XesExportOption } from '../types/xes-viewer.types';

export const XES_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.xes', '.xml'];

export const XES_ACCEPT_ATTR = '.xes,.xml,application/xml,text/xml';

/** Keep large industrial logs from locking the tab. */
export const XES_MAX_FILE_BYTES = 50 * 1024 * 1024;

export const XES_CONCEPT_NAME = 'concept:name';
export const XES_TIME_TIMESTAMP = 'time:timestamp';
export const XES_ORG_RESOURCE = 'org:resource';
export const XES_LIFECYCLE_TRANSITION = 'lifecycle:transition';

export const XES_PAGE_SIZE = 100;
export const XES_SEARCH_DEBOUNCE_MS = 200;
export const XES_TOP_ACTIVITIES = 12;
export const XES_TOP_VARIANTS = 20;
export const XES_TOP_INSIGHT_ITEMS = 8;
export const XES_TOP_CASE_HIGHLIGHTS = 5;

export const XES_EXPORT_GROUP_LABELS: Record<string, string> = {
  events: 'Events',
  cases: 'Cases & paths',
  analytics: 'Analytics',
  source: 'Source'
};

export const XES_EXPORT_OPTIONS: ReadonlyArray<XesExportOption> = [
  {
    id: 'events-csv',
    label: 'Events CSV',
    description: 'Filtered events with every attribute as a column',
    extension: 'csv',
    group: 'events'
  },
  {
    id: 'events-tsv',
    label: 'Events TSV',
    description: 'Tab-separated events for spreadsheets and BI tools',
    extension: 'tsv',
    group: 'events'
  },
  {
    id: 'events-json',
    label: 'Events JSON',
    description: 'Filtered events as a JSON array',
    extension: 'json',
    group: 'events'
  },
  {
    id: 'timeline-csv',
    label: 'Timeline CSV',
    description: 'Filtered events with relative seconds from case start',
    extension: 'csv',
    group: 'events'
  },
  {
    id: 'cases-csv',
    label: 'Cases CSV',
    description: 'One row per case with path and duration',
    extension: 'csv',
    group: 'cases'
  },
  {
    id: 'cases-json',
    label: 'Cases JSON',
    description: 'Cases with attributes, duration, and full activity path',
    extension: 'json',
    group: 'cases'
  },
  {
    id: 'activities-csv',
    label: 'Activities CSV',
    description: 'Activity frequency ranking',
    extension: 'csv',
    group: 'cases'
  },
  {
    id: 'variants-csv',
    label: 'Variants CSV',
    description: 'Distinct process paths and case counts',
    extension: 'csv',
    group: 'cases'
  },
  {
    id: 'transitions-csv',
    label: 'Transitions CSV',
    description: 'Directly-follows edges (A → B) with frequencies',
    extension: 'csv',
    group: 'analytics'
  },
  {
    id: 'resources-csv',
    label: 'Resources CSV',
    description: 'Resource workload ranking',
    extension: 'csv',
    group: 'analytics'
  },
  {
    id: 'start-end-csv',
    label: 'Start / end CSV',
    description: 'Start and end activity frequencies',
    extension: 'csv',
    group: 'analytics'
  },
  {
    id: 'dfg-dot',
    label: 'DFG Graphviz DOT',
    description: 'Process map edges for Graphviz / viz tools',
    extension: 'dot',
    group: 'analytics'
  },
  {
    id: 'summary-json',
    label: 'Analytics summary',
    description: 'Full stats, insights, activities and variants as JSON',
    extension: 'json',
    group: 'analytics'
  },
  {
    id: 'markdown-report',
    label: 'Markdown report',
    description: 'Human-readable analytics report with key findings',
    extension: 'md',
    group: 'analytics'
  },
  {
    id: 'full-report-csv',
    label: 'Full report CSV',
    description: 'Complete analysis workbook: overview, findings, rankings',
    extension: 'csv',
    group: 'analytics'
  },
  {
    id: 'full-report-pdf',
    label: 'Full report PDF',
    description: 'Printable multi-page analysis document',
    extension: 'pdf',
    group: 'analytics'
  },
  {
    id: 'original-xes',
    label: 'Original XES',
    description: 'Download the uploaded event log unchanged',
    extension: 'xes',
    group: 'source'
  }
];

export const XES_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Log Viewer',
    path: '/file-viewers/log-viewer',
    description: 'Search and filter plain-text application logs'
  },
  {
    label: 'Text File Viewer',
    path: '/file-viewers/text-file-viewer',
    description: 'Open raw XML dumps when you need the source markup'
  },
  {
    label: 'Excel Viewer',
    path: '/file-viewers/excel-viewer',
    description: 'Inspect CSV event exports side by side with XES'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print exported event rows as JSON'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Confirm MIME type and size for unusual log packages'
  }
];
