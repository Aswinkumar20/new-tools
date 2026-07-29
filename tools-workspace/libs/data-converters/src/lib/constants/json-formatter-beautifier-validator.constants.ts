import type { DcRelatedToolLink } from '../shared/dc-tool-suggestion.model';
import type { JsonFormatterResultTabOption } from '../types/json-formatter-beautifier-validator.types';

export const JSON_FORMATTER_HISTORY_LIMIT = 5;

export const JSON_FORMATTER_INDENTATION_OPTIONS = [2, 4, 6] as const;

export const JSON_FORMATTER_DEFAULT_SAMPLE = {
  tool: 'JSON Formatter & Validator',
  description:
    'Paste JSON, format it with your preferred indentation, and validate the structure instantly.',
  settings: {
    Indentation: 2,
    autoValidate: true,
    theme: 'system'
  },
  metadata: {
    author: 'Tools Workspace',
    updated: '2025-10-01',
    tags: ['json', 'format', 'validate']
  },
  payload: [
    {
      id: 1,
      name: 'item A',
      value: 100,
      details: {
        status: 'active',
        createdAt: '2024-01-15T10:00:00Z'
      }
    },
    {
      id: 2,
      name: 'item B',
      value: 200,
      details: {
        status: 'pending',
        createdAt: '2024-02-20T11:30:00Z'
      }
    },
    {
      id: 3,
      name: 'item C',
      value: 350,
      details: {
        status: 'archived',
        createdAt: '2024-03-05T09:00:00Z'
      }
    }
  ]
};

export const JSON_FORMATTER_RESULT_TABS: ReadonlyArray<JsonFormatterResultTabOption> = [
  {
    id: 'formatted',
    label: 'Formatted',
    description: 'Beautified or minified JSON output ready to copy or download.'
  },
  {
    id: 'tree',
    label: 'Tree',
    description: 'Navigate the JSON structure with collapsible nodes for quick inspection.'
  },
  {
    id: 'validation',
    label: 'Validation',
    description: 'Syntax feedback with precise line and column references.'
  }
];

export const JSON_FORMATTER_TIPS = [
  'Use the beautify action to reformat pasted JSON and instantly clean up indentation.',
  'Switch to the tree view to navigate large payloads without scrolling through raw text.',
  'Minify before sending JSON to APIs to keep payloads lean and performant.',
  'Auto-validation keeps an eye on syntax while you type—toggle it off for massive files.'
] as const;

export const JSON_FORMATTER_USAGE_STEPS = [
  'Paste or drop a JSON file into the editor. A sample payload loads by default.',
  'Pick your indentation preference, then beautify or minify with a single click.',
  'Toggle validation to inspect errors, including line and column references.',
  'Copy, download, or explore the tree view before sharing the payload with your team.'
] as const;

export const JSON_FORMATTER_CALLOUTS = [
  { title: 'Single Source', detail: 'Work with one JSON document at a time with zero distractions.' },
  { title: 'Instant Feedback', detail: 'Validation highlights the exact line and column of issues.' },
  {
    title: 'Shareable Output',
    detail: 'Copy to clipboard or download the formatted file for documentation.'
  }
] as const;

export const JSON_FORMATTER_KEYBOARD_SHORTCUTS_TOOLTIP =
  'Keyboard Shortcuts:\nCtrl+B - Beautify JSON\nCtrl+M - Minify JSON\nCtrl+V - Validate JSON\nCtrl+F - Auto-Fix JSON\nCtrl+C - Copy Output\nCtrl+S - Download Output';

export const JSON_FORMATTER_RELATED_TOOLS: ReadonlyArray<DcRelatedToolLink> = [
  {
    label: 'JSON Linter Viewer',
    path: '/data-converters/json-linter-viewer',
    description: 'Lint JSON with richer diagnostics'
  },
  {
    label: 'JSON Parser',
    path: '/data-converters/json-parser',
    description: 'Parse and inspect JSON structures'
  },
  {
    label: 'CSV ⇄ JSON',
    path: '/data-converters/csv-to-json-json-to-csv',
    description: 'Convert formatted JSON to CSV rows'
  },
  {
    label: 'YAML ⇄ JSON',
    path: '/data-converters/yaml-to-json-json-to-yaml',
    description: 'Round-trip configuration as YAML'
  },
  {
    label: 'Excel to JSON',
    path: '/data-converters/excel-to-json',
    description: 'Import spreadsheet data as JSON'
  }
];
