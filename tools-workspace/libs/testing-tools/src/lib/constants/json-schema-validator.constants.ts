import type { TtRelatedToolLink } from '../shared/tt-tool-suggestion.model';
import type { JsonSchemaFormValues } from '../types/json-schema-validator.types';

export const JSON_SCHEMA_DEFAULT_SCHEMA = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" },
    "email": { "type": "string" }
  },
  "required": ["name", "email"]
}`;

export const JSON_SCHEMA_DEFAULT_DATA = `{
  "name": "Ada Lovelace",
  "age": 36,
  "email": "ada@example.com"
}`;

export const JSON_SCHEMA_DEFAULT_FORM: JsonSchemaFormValues = {
  schema: JSON_SCHEMA_DEFAULT_SCHEMA,
  data: JSON_SCHEMA_DEFAULT_DATA,
  draft: 'draft7',
  strictTypes: true
};

export const JSON_SCHEMA_RELATED_TOOLS: ReadonlyArray<TtRelatedToolLink> = [
  {
    label: 'JSON Formatter / Beautifier / Validator',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Fix or pretty-print JSON before validating against a schema'
  },
  {
    label: 'Email / URL / IP Checker',
    path: '/testing-tools/email-url-ip-checker',
    description: 'Validate string field formats referenced by your schema'
  },
  {
    label: 'JWT Decoder',
    path: '/testing-tools/jwt-decoder',
    description: 'Inspect token payloads when schemas describe auth responses'
  },
  {
    label: 'Password Rule Validator',
    path: '/testing-tools/password-rule-validator',
    description: 'Check password policy strings used in form/API contracts'
  }
];
