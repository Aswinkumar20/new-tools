import type { DcRelatedToolLink } from '../shared/dc-tool-suggestion.model';
import type { YamlJsonCallout, YamlJsonModeOption } from '../types/yaml-to-json-json-to-yaml.types';

export const YAML_JSON_HISTORY_LIMIT = 6;

export const YAML_JSON_SAMPLE_YAML = `users:
  - id: 1
    name: Ada Lovelace
    active: true
  - id: 2
    name: Alan Turing
    active: false
settings:
  theme: dark
  notifications: true`;

export const YAML_JSON_SAMPLE_JSON = `{
  "project": "Atlas",
  "version": "1.0.0",
  "owners": [
    {
      "name": "Chris",
      "email": "chris@example.com"
    },
    {
      "name": "Morgan",
      "email": "morgan@example.com"
    }
  ]
}`;

export const YAML_JSON_MODES: ReadonlyArray<YamlJsonModeOption> = [
  {
    id: 'yaml-to-json',
    label: 'YAML → JSON',
    description: 'Convert configuration files into JSON for APIs, tooling, or automation.'
  },
  {
    id: 'json-to-yaml',
    label: 'JSON → YAML',
    description: 'Produce readable YAML from JSON with indentation and quoting controls.'
  }
];

export const YAML_JSON_USAGE_STEPS = [
  'Pick the conversion direction you need.',
  'Paste or drop YAML/JSON into the editor and tweak indentation options.',
  'Run the conversion. We surface syntax errors with helpful messages.',
  'Copy or download the result and reuse recent actions from the history log.'
] as const;

export const YAML_JSON_CALLOUTS: ReadonlyArray<YamlJsonCallout> = [
  { title: 'Two-way converter', detail: 'Swap between YAML and JSON without leaving the page.' },
  { title: 'Whitespace aware', detail: 'Preserve indentation and optionally sort object keys.' },
  { title: 'Share ready', detail: 'Copy to clipboard or download to share with your team instantly.' }
];

export const YAML_JSON_RELATED_TOOLS: ReadonlyArray<DcRelatedToolLink> = [
  {
    label: 'JSON Formatter & Validator',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Beautify and validate converted JSON'
  },
  {
    label: 'JSON Linter Viewer',
    path: '/data-converters/json-linter-viewer',
    description: 'Lint JSON with cleanup options'
  },
  {
    label: 'JSON Parser',
    path: '/data-converters/json-parser',
    description: 'Explore JSON as a collapsible tree'
  },
  {
    label: 'CSV ⇄ JSON',
    path: '/data-converters/csv-to-json-json-to-csv',
    description: 'Convert object arrays to spreadsheet rows'
  },
  {
    label: 'Excel to JSON',
    path: '/data-converters/excel-to-json',
    description: 'Import spreadsheet data as JSON'
  }
];
