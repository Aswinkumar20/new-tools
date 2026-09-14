import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const INVOICE_DATA_TITLE = 'Invoice Data Viewer';
export const INVOICE_DATA_DESCRIPTION =
  'Explore invoice JSON or XML exports with line items, totals, and party fields.';
export const INVOICE_DATA_ACCEPT_ATTR = '.json,.xml,application/json,text/xml,application/xml';
export const INVOICE_DATA_FORMATS_LABEL = 'JSON, XML';

export const INVOICE_DATA_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Excel Viewer',
    path: '/file-viewers/excel-viewer',
    description: 'Open spreadsheet-based invoice exports'
  },
  {
    label: 'Text File Viewer',
    path: '/file-viewers/text-file-viewer',
    description: 'Read unstructured invoice text'
  }
];

export const INVOICE_DATA_HELP_ITEMS = [
  'Upload invoice JSON or XML.',
  'Review vendor, customer, and dates.',
  'Inspect line items and totals.'
] as const;
