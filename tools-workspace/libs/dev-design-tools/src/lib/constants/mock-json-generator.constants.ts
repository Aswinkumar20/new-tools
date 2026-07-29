import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';
import type { MockJsonFieldType, MockJsonFieldTypeOption } from '../types/mock-json-generator.types';

export const MOCK_JSON_HISTORY_LIMIT = 10;
export const MOCK_JSON_ARRAY_COUNT_MIN = 1;
export const MOCK_JSON_ARRAY_COUNT_MAX = 100;
export const MOCK_JSON_DEFAULT_ARRAY_COUNT = 1;
export const MOCK_JSON_DEFAULT_ARRAY_LENGTH = 3;

export const MOCK_JSON_FIELD_TYPES: ReadonlyArray<MockJsonFieldTypeOption> = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' },
  { value: 'null', label: 'Null' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
  { value: 'uuid', label: 'UUID' }
];

export const MOCK_JSON_FIELD_PLACEHOLDERS: Readonly<Record<MockJsonFieldType, string>> = {
  string: 'Default value',
  number: 'Default number',
  boolean: 'true or false',
  array: '',
  object: '',
  null: '',
  email: 'user@example.com',
  url: 'https://example.com',
  date: 'ISO date string',
  uuid: 'UUID string'
};

export const MOCK_JSON_DEFAULT_FIELDS = [
  { key: 'name', type: 'string' as const, value: 'John Doe' },
  { key: 'age', type: 'number' as const, value: '25' },
  { key: 'active', type: 'boolean' as const, value: 'true' }
];

export const MOCK_JSON_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print and validate generated mock payloads'
  },
  {
    label: 'JSON Linter',
    path: '/data-converters/json-linter-viewer',
    description: 'Lint larger mock datasets before API tests'
  },
  {
    label: 'HTTP Request Generator',
    path: '/dev-design-tools/http-request-generator',
    description: 'Send mock JSON as a request body snippet'
  }
];
