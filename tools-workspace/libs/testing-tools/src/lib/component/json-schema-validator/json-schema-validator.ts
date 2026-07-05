import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type SchemaDraft = 'draft7' | 'draft2019-09' | 'draft2020-12';

interface ValidationIssue {
  path: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  instanceType: string;
  schemaType: string;
}

type JsonSchemaFormGroup = FormGroup<{
  schema: FormControl<string>;
  data: FormControl<string>;
  draft: FormControl<SchemaDraft>;
  strictTypes: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-json-schema-validator',
  standalone: true,
  templateUrl: './json-schema-validator.html',
  styleUrls: ['./json-schema-validator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JsonSchemaValidatorComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: JsonSchemaFormGroup = this.fb.group({
    schema: this.fb.control(
      `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" },
    "email": { "type": "string" }
  },
  "required": ["name", "email"]
}`,
      { nonNullable: true }
    ),
    data: this.fb.control(
      `{
  "name": "Ada Lovelace",
  "age": 36,
  "email": "ada@example.com"
}`,
      { nonNullable: true }
    ),
    draft: this.fb.control<SchemaDraft>('draft7', { nonNullable: true }),
    strictTypes: this.fb.control(true, { nonNullable: true })
  });

  constructor() {
    if (this.form.controls.schema.value.trim() && this.form.controls.data.value.trim()) {
      this.validate();
    }
  }

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result = signal<ValidationResult | null>(null);

  readonly hasResult = computed(() => this.result() !== null);
  readonly isValid = computed(() => !!this.result() && this.result()!.valid);
  readonly issues = computed(() => this.result()?.issues ?? []);

  readonly hasInput = computed(
    () => !!this.form.controls.schema.value.trim() || !!this.form.controls.data.value.trim()
  );

  onInputChange(): void {
    if (this.form.controls.schema.value.trim() && this.form.controls.data.value.trim()) {
      this.validate();
    } else {
      this.result.set(null);
      this.errors.set([]);
    }
  }

  onOptionChange(): void {
    if (this.form.controls.schema.value.trim() && this.form.controls.data.value.trim()) {
      this.validate();
    }
  }

  clear(): void {
    this.form.controls.schema.setValue('');
    this.form.controls.data.setValue('');
    this.result.set(null);
    this.errors.set([]);
    this.warnings.set([]);
  }

  copySchema(): void {
    this.copyText(this.form.controls.schema.value, 'Schema');
  }

  copyData(): void {
    this.copyText(this.form.controls.data.value, 'Data');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  validate(): void {
    this.errors.set([]);
    this.warnings.set([]);
    this.result.set(null);

    const { schema: schemaText, data: dataText, strictTypes } = this.form.getRawValue();

    let schema: unknown;
    let data: unknown;

    try {
      schema = JSON.parse(schemaText);
    } catch (e) {
      this.errors.set([`Schema is not valid JSON: ${(e as Error).message}`]);
      return;
    }

    try {
      data = JSON.parse(dataText);
    } catch (e) {
      this.errors.set([`Data is not valid JSON: ${(e as Error).message}`]);
      return;
    }

    const issues: ValidationIssue[] = [];
    const schemaType = this.describeType(schema);
    const instanceType = this.describeType(data);

    if (!this.isObject(schema)) {
      issues.push({ path: '', message: 'Schema must be a JSON object.' });
    } else {
      this.validateAgainstSchema(schema as Record<string, unknown>, data, '', issues, strictTypes);
    }

    const valid = issues.length === 0;
    this.result.set({
      valid,
      issues,
      instanceType,
      schemaType
    });
  }

  private validateAgainstSchema(
    schema: Record<string, unknown>,
    data: unknown,
    path: string,
    issues: ValidationIssue[],
    strictTypes: boolean
  ): void {
    const schemaType = schema['type' as keyof typeof schema];

    if (schemaType) {
      const expectedTypes = Array.isArray(schemaType) ? schemaType : [schemaType];
      const dataType = this.jsonTypeOf(data);
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

    if (schema['type' as keyof typeof schema] === 'object' && this.isObject(data)) {
      const properties = (schema['properties' as keyof typeof schema] as Record<string, unknown>) ?? {};
      const required = (schema['required' as keyof typeof schema] as string[]) ?? [];

      for (const key of required) {
        if (!Object.prototype.hasOwnProperty.call(data as Record<string, unknown>, key)) {
          issues.push({
            path: this.joinPath(path, key),
            message: 'Missing required property.'
          });
        }
      }

      for (const key of Object.keys(properties)) {
        const childSchema = properties[key] as Record<string, unknown>;
        const childData = (data as Record<string, unknown>)[key];
        if (childData === undefined) {
          continue;
        }
        this.validateAgainstSchema(childSchema, childData, this.joinPath(path, key), issues, strictTypes);
      }
    }

    if (schema['type' as keyof typeof schema] === 'array' && Array.isArray(data)) {
      const itemsSchema = schema['items' as keyof typeof schema] as Record<string, unknown> | undefined;
      if (itemsSchema) {
        for (let index = 0; index < data.length; index++) {
          const item = data[index];
          this.validateAgainstSchema(itemsSchema, item, this.joinPath(path, String(index)), issues, strictTypes);
        }
      }
    }
  }

  private joinPath(base: string, key: string): string {
    if (!base) {
      return key;
    }
    if (/^\d+$/.test(key)) {
      return `${base}[${key}]`;
    }
    return `${base}.${key}`;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private jsonTypeOf(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return 'array';
    }
    return typeof value;
  }

  private describeType(value: unknown): string {
    const t = this.jsonTypeOf(value);
    if (t === 'object') {
      const keys = Object.keys(value as Record<string, unknown>);
      return `object (${keys.length} keys)`;
    }
    if (t === 'array') {
      return `array (${(value as unknown[]).length} items)`;
    }
    return t;
  }
}
