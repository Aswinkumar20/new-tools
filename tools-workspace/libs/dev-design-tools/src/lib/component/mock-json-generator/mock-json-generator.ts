import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | 'email' | 'url' | 'date' | 'uuid';

interface JsonField {
  key: string;
  type: FieldType;
  value?: string;
  arrayLength?: number;
  nestedFields?: JsonField[];
}

interface HistoryEntry {
  timestamp: number;
  fields: JsonField[];
  generatedJson: string;
}

type MockJsonFormGroup = FormGroup<{
  fields: FormArray<FormGroup<{
    key: FormControl<string>;
    type: FormControl<FieldType>;
    value: FormControl<string>;
    arrayLength: FormControl<number>;
  }>>;
  arrayCount: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
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

@Component({
  selector: 'lib-mock-json-generator',
  standalone: true,
  templateUrl: './mock-json-generator.html',
  styleUrls: ['./mock-json-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MockJsonGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: MockJsonFormGroup = this.fb.group({
    fields: this.fb.array<FormGroup<{
      key: FormControl<string>;
      type: FormControl<FieldType>;
      value: FormControl<string>;
      arrayLength: FormControl<number>;
    }>>([
      this.createField('name', 'string', 'John Doe'),
      this.createField('age', 'number', '25'),
      this.createField('active', 'boolean', 'true')
    ]),
    arrayCount: this.fb.control(1, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(100)]
    }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly fieldTypes = FIELD_TYPES;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly generatedJson = signal<string>('');
  readonly history = signal<HistoryEntry[]>([]);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasGeneratedJson = computed(() => this.generatedJson().length > 0);
  readonly fieldsFormArray = computed(() => this.form.controls.fields);
  readonly formattedJson = computed(() => this.formatJson(this.generatedJson()));

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.generateJson();
      });

    // Initial generation
    this.generateJson();
  }

  get fields(): FormArray<FormGroup<{ key: FormControl<string>; type: FormControl<FieldType>; value: FormControl<string>; arrayLength: FormControl<number> }>> {
    return this.form.controls.fields;
  }

  private createField(key: string = '', type: FieldType = 'string', value: string = '', arrayLength: number = 3): FormGroup<{
    key: FormControl<string>;
    type: FormControl<FieldType>;
    value: FormControl<string>;
    arrayLength: FormControl<number>;
  }> {
    return this.fb.group({
      key: this.fb.control(key, { nonNullable: true }),
      type: this.fb.control<FieldType>(type, { nonNullable: true }),
      value: this.fb.control(value, { nonNullable: true }),
      arrayLength: this.fb.control(arrayLength, {
        nonNullable: true,
        validators: [Validators.min(1), Validators.max(100)]
      })
    });
  }

  addField(): void {
    this.fields.push(this.createField());
  }

  removeField(index: number): void {
    if (this.fields.length > 0) {
      this.fields.removeAt(index);
    }
  }

  generateJson(): void {
    this.errors.set([]);
    this.warnings.set([]);

    try {
      const { fields, arrayCount } = this.form.getRawValue();
      const result: unknown[] = [];

      for (let i = 0; i < arrayCount; i++) {
        const obj: Record<string, unknown> = {};

        for (const field of fields) {
          if (!field.key) {
            continue;
          }

          obj[field.key] = this.generateValue(field, i);
        }

        result.push(obj);
      }

      const jsonString = arrayCount === 1 ? JSON.stringify(result[0], null, 2) : JSON.stringify(result, null, 2);
      this.generatedJson.set(jsonString);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(fields, jsonString);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate JSON';
      this.errors.set([errorMessage]);
      this.generatedJson.set('');
    }
  }

  private generateValue(field: { key: string; type: FieldType; value: string; arrayLength: number }, index: number): unknown {
    switch (field.type) {
      case 'string':
        return field.value || `String ${index + 1}`;
      case 'number':
        return field.value ? Number.parseFloat(field.value) || 0 : index + 1;
      case 'boolean':
        return field.value === 'true' || field.value === '' ? true : false;
      case 'null':
        return null;
      case 'email':
        return field.value || `user${index + 1}@example.com`;
      case 'url':
        return field.value || `https://example.com/item${index + 1}`;
      case 'date':
        return field.value || new Date().toISOString();
      case 'uuid':
        return field.value || this.generateUuid();
      case 'array':
        return this.generateArray(field, index);
      case 'object':
        return this.generateObject(field, index);
      default:
        return field.value || '';
    }
  }

  private generateArray(field: { key: string; type: FieldType; value: string; arrayLength: number }, index: number): unknown[] {
    const length = field.arrayLength || 3;
    const array: unknown[] = [];

    // Try to parse value as a type hint
    const itemType = this.parseArrayItemType(field.value);

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

  private generateObject(field: { key: string; type: FieldType; value: string; arrayLength: number }, index: number): Record<string, unknown> {
    // Simple object generation
    return {
      id: index + 1,
      name: `Object ${index + 1}`,
      value: field.value || 'default'
    };
  }

  private parseArrayItemType(value: string): 'string' | 'number' | 'boolean' {
    if (value.toLowerCase().includes('number') || value.toLowerCase().includes('num')) {
      return 'number';
    }
    if (value.toLowerCase().includes('boolean') || value.toLowerCase().includes('bool')) {
      return 'boolean';
    }
    return 'string';
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  formatJson(json: string): string {
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

  copyToClipboard(text: string, label: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Success
      })
      .catch(() => {
        this.errors.set([`Unable to copy ${label} to clipboard.`]);
      });
  }

  clear(): void {
    while (this.fields.length > 0) {
      this.fields.removeAt(0);
    }
    this.fields.push(this.createField('name', 'string', 'John Doe'));
    this.fields.push(this.createField('age', 'number', '25'));
    this.fields.push(this.createField('active', 'boolean', 'true'));
    this.form.patchValue({ arrayCount: 1 });
    this.generatedJson.set('');
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: HistoryEntry): void {
    // Rebuild fields from history
    while (this.fields.length > 0) {
      this.fields.removeAt(0);
    }

    for (const field of entry.fields) {
      this.fields.push(
        this.createField(
          field.key,
          field.type,
          field.value || '',
          field.arrayLength || 3
        )
      );
    }

    this.generatedJson.set(entry.generatedJson);
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  private addToHistory(fields: Array<{ key: string; type: FieldType; value: string; arrayLength: number }>, json: string): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      fields: fields.map((f) => ({
        key: f.key,
        type: f.type,
        value: f.value,
        arrayLength: f.arrayLength
      })),
      generatedJson: json
    };

    this.history.update((entries) => {
      const exists = entries.some((e) => e.generatedJson === entry.generatedJson);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  getFieldPlaceholder(type: FieldType): string {
    const placeholders: Record<FieldType, string> = {
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
    return placeholders[type] || 'Value';
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (days < 7) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}
