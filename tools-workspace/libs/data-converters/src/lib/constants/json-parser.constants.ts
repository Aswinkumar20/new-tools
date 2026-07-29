import type { DcRelatedToolLink } from '../shared/dc-tool-suggestion.model';
import type {
  JsonParserHeroHighlight,
  JsonParserPreviewModeOption
} from '../types/json-parser.types';

export const JSON_PARSER_HISTORY_LIMIT = 6;

export const JSON_PARSER_SAMPLE_JSON = `{
  "meta": {
    "title": "Example dataset",
    "version": 2,
    "published": true
  },
  "authors": [
    {
      "name": "Ada Lovelace",
      "role": "Analyst",
      "social": {
        "github": "ada",
        "twitter": "@ada"
      }
    },
    {
      "name": "Alan Turing",
      "role": "Researcher",
      "social": {
        "github": "aturing",
        "twitter": "@aturing"
      }
    }
  ]
}`;

export const JSON_PARSER_HERO_HIGHLIGHTS: ReadonlyArray<JsonParserHeroHighlight> = [
  {
    title: 'Visual tree viewer',
    detail: 'Inspect nested objects and arrays with collapsible nodes and breadcrumb context.'
  },
  {
    title: 'Quick transformations',
    detail: 'Format, minify, or filter JSON keys before exporting the result.'
  },
  {
    title: 'Copy-friendly',
    detail: 'Grab JSONPath, raw values, or formatted output with a single click.'
  }
];

export const JSON_PARSER_PREVIEW_MODES: ReadonlyArray<JsonParserPreviewModeOption> = [
  { id: 'formatted', label: 'Formatted' },
  { id: 'minified', label: 'Minified' }
];

export const JSON_PARSER_STRINGIFY_PLACEHOLDER = `{
  "title": "Example",
  "items": [1, 2, 3]
}`;

export const JSON_PARSER_STRING_LITERAL_PLACEHOLDER =
  '{"title":"Example","items":[1,2,3]}';

export const JSON_PARSER_RELATED_TOOLS: ReadonlyArray<DcRelatedToolLink> = [
  {
    label: 'JSON Formatter & Validator',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Beautify and validate with line diagnostics'
  },
  {
    label: 'JSON Linter Viewer',
    path: '/data-converters/json-linter-viewer',
    description: 'Lint with comment and trailing-comma cleanup'
  },
  {
    label: 'CSV ⇄ JSON',
    path: '/data-converters/csv-to-json-json-to-csv',
    description: 'Convert object arrays to spreadsheet rows'
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
