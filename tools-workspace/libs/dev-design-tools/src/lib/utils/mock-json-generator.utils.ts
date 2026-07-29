import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import {
  MOCK_JSON_ARRAY_COUNT_MAX,
  MOCK_JSON_ARRAY_COUNT_MIN,
  MOCK_JSON_FIELD_PLACEHOLDERS,
  MOCK_JSON_HISTORY_LIMIT
} from '../constants/mock-json-generator.constants';
import type {
  MockJsonField,
  MockJsonFieldInput,
  MockJsonFieldType,
  MockJsonGenerateResult,
  MockJsonHistoryEntry
} from '../types/mock-json-generator.types';

export function getFieldPlaceholder(type: MockJsonFieldType): string {
  return MOCK_JSON_FIELD_PLACEHOLDERS[type] || 'Value';
}

export function formatJsonString(json: string): string {
  if (!json) {
    return '';
  }
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return json;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function formatRelativeTimestamp(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString();
}

export function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function parseArrayItemType(value: string): 'string' | 'number' | 'boolean' {
  const normalized = (value || 'string').toLowerCase().trim();
  if (normalized === 'number' || normalized.includes('number') || normalized.includes('num')) {
    return 'number';
  }
  if (normalized === 'boolean' || normalized.includes('boolean') || normalized.includes('bool')) {
    return 'boolean';
  }
  return 'string';
}

export function generateArrayValue(field: MockJsonFieldInput, _index: number): unknown[] {
  const length = field.arrayLength || 3;
  const array: unknown[] = [];
  const itemType = parseArrayItemType(field.value);

  for (let i = 0; i < length; i++) {
    switch (itemType) {
      case 'string':
        array.push(`Item ${i + 1}`);
        break;
      case 'number':
        array.push(i + 1);
        break;
      case 'boolean':
        array.push(i % 2 === 0);
        break;
      default:
        array.push(`Item ${i + 1}`);
    }
  }

  return array;
}

export function generateObjectValue(field: MockJsonFieldInput, index: number): Record<string, unknown> {
  return {
    id: index + 1,
    name: `Object ${index + 1}`,
    value: field.value || 'default'
  };
}

export function generateFieldValue(field: MockJsonFieldInput, index: number): unknown {
  switch (field.type) {
    case 'string':
      return field.value || `String ${index + 1}`;
    case 'number': {
      if (!field.value) {
        return index + 1;
      }
      const parsed = Number(field.value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    case 'boolean':
      if (!field.value) {
        return true;
      }
      return ['true', '1', 'yes'].includes(field.value.toLowerCase());
    case 'null':
      return null;
    case 'email':
      return field.value || `user${index + 1}@example.com`;
    case 'url':
      return field.value || `https://example.com/item${index + 1}`;
    case 'date':
      return field.value || new Date().toISOString();
    case 'uuid':
      return field.value || generateUuid();
    case 'array':
      return generateArrayValue(field, index);
    case 'object':
      return generateObjectValue(field, index);
    default:
      return field.value || '';
  }
}

export function generateMockJson(
  fields: ReadonlyArray<MockJsonFieldInput>,
  arrayCount: number
): MockJsonGenerateResult {
  const count = Math.min(MOCK_JSON_ARRAY_COUNT_MAX, Math.max(MOCK_JSON_ARRAY_COUNT_MIN, arrayCount || 1));
  const keys = fields.map((f) => f.key.trim()).filter(Boolean);
  const warnings: string[] = [];

  if (new Set(keys).size !== keys.length) {
    warnings.push('Duplicate field names — later fields overwrite earlier ones.');
  }
  if (!keys.length) {
    return {
      json: '',
      warnings,
      error: 'Add at least one field with a name.'
    };
  }

  const result: unknown[] = [];

  for (let i = 0; i < count; i++) {
    const obj: Record<string, unknown> = {};

    for (const field of fields) {
      if (!field.key) {
        continue;
      }
      obj[field.key] = generateFieldValue(field, i);
    }

    result.push(obj);
  }

  const json = count === 1 ? JSON.stringify(result[0], null, 2) : JSON.stringify(result, null, 2);
  return { json, warnings, error: null };
}

export function prependMockJsonHistory(
  entries: MockJsonHistoryEntry[],
  entry: MockJsonHistoryEntry,
  limit = MOCK_JSON_HISTORY_LIMIT
): MockJsonHistoryEntry[] {
  const exists = entries.some((existing) => existing.generatedJson === entry.generatedJson);
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function toHistoryFields(fields: ReadonlyArray<MockJsonFieldInput>): MockJsonField[] {
  return fields.map((f) => ({
    key: f.key,
    type: f.type,
    value: f.value,
    arrayLength: f.arrayLength
  }));
}

export function resolveMockJsonSuggestion(options: {
  hasGeneratedJson: boolean;
  hasCopiedJson: boolean;
  arrayCount: number;
  fieldTypes: ReadonlyArray<MockJsonFieldType>;
  hasDuplicateWarning: boolean;
}): DdToolSuggestion | null {
  const { hasGeneratedJson, hasCopiedJson, arrayCount, fieldTypes, hasDuplicateWarning } = options;
  if (!hasGeneratedJson) {
    return null;
  }

  if (hasDuplicateWarning) {
    return {
      id: 'mjg-linter',
      title: 'Lint this payload for conflicts?',
      reason: 'Duplicate field names were detected. The JSON Linter helps spot structural issues before tests.',
      actionLabel: 'Open JSON Linter',
      path: '/data-converters/json-linter-viewer'
    };
  }

  if (hasCopiedJson) {
    return {
      id: 'mjg-formatter',
      title: 'Validate the copied JSON?',
      reason: 'JSON Formatter can beautify and confirm the mock payload before you paste it into an API client.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (arrayCount >= 10) {
    return {
      id: 'mjg-large',
      title: 'Review a large mock dataset?',
      reason: 'You are generating many objects. Lint the output so oversized fixtures stay readable.',
      actionLabel: 'Open JSON Linter',
      path: '/data-converters/json-linter-viewer'
    };
  }

  if (fieldTypes.includes('email') || fieldTypes.includes('uuid') || fieldTypes.includes('url')) {
    return {
      id: 'mjg-http',
      title: 'Use this mock as a request body?',
      reason: 'Identity-style fields are ready for API stubs. Generate a client snippet next.',
      actionLabel: 'Open HTTP Request Generator',
      path: '/dev-design-tools/http-request-generator'
    };
  }

  return null;
}
