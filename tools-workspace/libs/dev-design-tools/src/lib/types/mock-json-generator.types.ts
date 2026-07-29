export type MockJsonFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null'
  | 'email'
  | 'url'
  | 'date'
  | 'uuid';

export interface MockJsonFieldTypeOption {
  value: MockJsonFieldType;
  label: string;
}

export interface MockJsonField {
  key: string;
  type: MockJsonFieldType;
  value?: string;
  arrayLength?: number;
  nestedFields?: MockJsonField[];
}

export interface MockJsonHistoryEntry {
  timestamp: number;
  fields: MockJsonField[];
  generatedJson: string;
}

export interface MockJsonFieldInput {
  key: string;
  type: MockJsonFieldType;
  value: string;
  arrayLength: number;
}

export interface MockJsonGenerateResult {
  json: string;
  warnings: string[];
  error: string | null;
}
