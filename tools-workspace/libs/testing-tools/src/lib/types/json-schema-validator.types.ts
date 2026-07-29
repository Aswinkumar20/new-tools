import type { FormControl, FormGroup } from '@angular/forms';

export type JsonSchemaDraft = 'draft7' | 'draft2019-09' | 'draft2020-12';

export interface JsonSchemaValidationIssue {
  path: string;
  message: string;
}

export interface JsonSchemaValidationResult {
  valid: boolean;
  issues: JsonSchemaValidationIssue[];
  instanceType: string;
  schemaType: string;
}

export type JsonSchemaFormGroup = FormGroup<{
  schema: FormControl<string>;
  data: FormControl<string>;
  draft: FormControl<JsonSchemaDraft>;
  strictTypes: FormControl<boolean>;
}>;

export interface JsonSchemaFormValues {
  schema: string;
  data: string;
  draft: JsonSchemaDraft;
  strictTypes: boolean;
}

export interface JsonSchemaValidateOutcome {
  result: JsonSchemaValidationResult | null;
  errors: string[];
}

export interface JsonSchemaSuggestionContext {
  hasSchema: boolean;
  hasData: boolean;
  hasResult: boolean;
  isValid: boolean;
  issueCount: number;
  errorMessage: string | null;
}
