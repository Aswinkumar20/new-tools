import type { TtToolSuggestion } from '../shared/tt-tool-suggestion.model';
import type {
  JsonSchemaFormValues,
  JsonSchemaSuggestionContext,
  JsonSchemaValidateOutcome,
  JsonSchemaValidationIssue,
  JsonSchemaValidationResult
} from '../types/json-schema-validator.types';

export function validateJsonSchemaDocument(
  options: Pick<JsonSchemaFormValues, 'schema' | 'data' | 'strictTypes'>
): JsonSchemaValidateOutcome {
  const { schema: schemaText, data: dataText, strictTypes } = options;

  let schema: unknown;
  let data: unknown;

  try {
    schema = JSON.parse(schemaText);
  } catch (e) {
    return {
      result: null,
      errors: [`Schema is not valid JSON: ${(e as Error).message}`]
    };
  }

  try {
    data = JSON.parse(dataText);
  } catch (e) {
    return {
      result: null,
      errors: [`Data is not valid JSON: ${(e as Error).message}`]
    };
  }

  const issues: JsonSchemaValidationIssue[] = [];
  const schemaType = describeJsonValueType(schema);
  const instanceType = describeJsonValueType(data);

  if (!isPlainObject(schema)) {
    issues.push({ path: '', message: 'Schema must be a JSON object.' });
  } else {
    validateAgainstSchema(schema, data, '', issues, strictTypes);
  }

  const result: JsonSchemaValidationResult = {
    valid: issues.length === 0,
    issues,
    instanceType,
    schemaType
  };

  return { result, errors: [] };
}

export function validateAgainstSchema(
  schema: Record<string, unknown>,
  data: unknown,
  path: string,
  issues: JsonSchemaValidationIssue[],
  strictTypes: boolean
): void {
  const schemaType = schema['type'];

  if (schemaType) {
    const expectedTypes = Array.isArray(schemaType) ? schemaType : [schemaType];
    const dataType = jsonTypeOf(data);
    if (!expectedTypes.includes(dataType)) {
      issues.push({
        path: path || '(root)',
        message: `Type mismatch: expected ${expectedTypes.join(' or ')}, got ${dataType}.`
      });
      if (strictTypes) {
        return;
      }
    }
  }

  if (schema['type'] === 'object' && isPlainObject(data)) {
    const properties = (schema['properties'] as Record<string, unknown>) ?? {};
    const required = (schema['required'] as string[]) ?? [];

    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        issues.push({
          path: joinJsonSchemaPath(path, key),
          message: 'Missing required property.'
        });
      }
    }

    for (const key of Object.keys(properties)) {
      const childSchema = properties[key] as Record<string, unknown>;
      const childData = data[key];
      if (childData === undefined) {
        continue;
      }
      validateAgainstSchema(
        childSchema,
        childData,
        joinJsonSchemaPath(path, key),
        issues,
        strictTypes
      );
    }
  }

  if (schema['type'] === 'array' && Array.isArray(data)) {
    const itemsSchema = schema['items'] as Record<string, unknown> | undefined;
    if (itemsSchema) {
      for (let index = 0; index < data.length; index++) {
        const item = data[index];
        validateAgainstSchema(
          itemsSchema,
          item,
          joinJsonSchemaPath(path, String(index)),
          issues,
          strictTypes
        );
      }
    }
  }
}

export function joinJsonSchemaPath(base: string, key: string): string {
  if (!base) {
    return key;
  }
  if (/^\d+$/.test(key)) {
    return `${base}[${key}]`;
  }
  return `${base}.${key}`;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function jsonTypeOf(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

export function describeJsonValueType(value: unknown): string {
  const t = jsonTypeOf(value);
  if (t === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return `object (${keys.length} keys)`;
  }
  if (t === 'array') {
    return `array (${(value as unknown[]).length} items)`;
  }
  return t;
}

export function resolveJsonSchemaSuggestion(
  context: JsonSchemaSuggestionContext
): TtToolSuggestion | null {
  const { hasSchema, hasData, hasResult, isValid, issueCount, errorMessage } = context;

  if (errorMessage?.includes('Schema is not valid JSON')) {
    return {
      id: 'jsv-schema-json',
      title: 'Schema JSON is invalid',
      reason:
        'Fix syntax first (commas, quotes, braces). The JSON Formatter can beautify and catch parse errors.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (errorMessage?.includes('Data is not valid JSON')) {
    return {
      id: 'jsv-data-json',
      title: 'Data JSON is invalid',
      reason:
        'The instance document must parse as JSON before schema checks can run. Format it, then re-validate here.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (!hasSchema && !hasData) {
    return {
      id: 'jsv-get-started',
      title: 'Validate an API contract?',
      reason:
        'Paste a JSON Schema and sample payload. Structural type/required/array checks run locally in the browser.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (hasSchema !== hasData) {
    return {
      id: 'jsv-need-both',
      title: hasSchema ? 'Add JSON data' : 'Add a JSON Schema',
      reason:
        'Both editors need content to validate. Keep editing — validation runs automatically when both sides are filled.',
      actionLabel: 'Open Email / URL / IP Checker',
      path: '/testing-tools/email-url-ip-checker'
    };
  }

  if (hasResult && isValid) {
    return {
      id: 'jsv-valid',
      title: 'Payload matches the schema',
      reason:
        'Structural checks passed. For string formats like email/URL/IP inside the payload, use the dedicated checker next.',
      actionLabel: 'Open Email / URL / IP Checker',
      path: '/testing-tools/email-url-ip-checker'
    };
  }

  if (hasResult && !isValid) {
    return {
      id: 'jsv-issues',
      title: `${issueCount} schema issue${issueCount === 1 ? '' : 's'} found`,
      reason:
        'Review path-based messages in Options. Fix types/required fields, or pretty-print JSON if the document is hard to read.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  return {
    id: 'jsv-ready',
    title: 'Ready to validate',
    reason: 'Click Validate or keep editing — results update when both schema and data are present.',
    actionLabel: 'Open JWT Decoder',
    path: '/testing-tools/jwt-decoder'
  };
}
