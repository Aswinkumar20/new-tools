import type { DcRelatedToolLink } from '../shared/dc-tool-suggestion.model';
import type { JsonLinterHeroHighlight } from '../types/json-linter-viewer.types';

export const JSON_LINTER_HISTORY_LIMIT = 6;

export const JSON_LINTER_INDENT_OPTIONS = [2, 4, 6] as const;

export const JSON_LINTER_SAMPLE_JSON = `{
  "meta": {
    "title": "World Cities",
    "generatedAt": "2025-10-22T10:00:00Z",
    "source": "https://example.com/api/cities"
  },
  "cities": [
    {
      "name": "Tokyo",
      "country": "Japan",
      "population": 37435191,
      "coordinates": { "lat": 35.6762, "lng": 139.6503 }
    },
    {
      "name": "Delhi",
      "country": "India",
      "population": 29399141,
      "coordinates": { "lat": 28.7041, "lng": 77.1025 }
    },
    {
      "name": "São Paulo",
      "country": "Brazil",
      "population": 21846507,
      "coordinates": { "lat": -23.5558, "lng": -46.6396 }
    }
  ]
}`;

export const JSON_LINTER_HERO_HIGHLIGHTS: ReadonlyArray<JsonLinterHeroHighlight> = [
  {
    title: 'Instant validation',
    detail: 'Surface syntax errors with precise line and column feedback before production.'
  },
  {
    title: 'Smart clean-up',
    detail: 'Optionally strip comments or trailing commas, and sort object keys for consistency.'
  },
  {
    title: 'Shareable output',
    detail: 'Copy to clipboard or download formatted/minified JSON with one click.'
  }
];

export const JSON_LINTER_RELATED_TOOLS: ReadonlyArray<DcRelatedToolLink> = [
  {
    label: 'JSON Formatter & Validator',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Beautify and explore JSON with a tree view'
  },
  {
    label: 'JSON Parser',
    path: '/data-converters/json-parser',
    description: 'Parse and inspect JSON structures'
  },
  {
    label: 'CSV ⇄ JSON',
    path: '/data-converters/csv-to-json-json-to-csv',
    description: 'Convert linted JSON arrays to CSV'
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
