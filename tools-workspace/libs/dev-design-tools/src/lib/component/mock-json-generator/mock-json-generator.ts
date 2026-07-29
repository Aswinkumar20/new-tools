import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  MOCK_JSON_ARRAY_COUNT_MAX,
  MOCK_JSON_ARRAY_COUNT_MIN,
  MOCK_JSON_DEFAULT_ARRAY_COUNT,
  MOCK_JSON_DEFAULT_ARRAY_LENGTH,
  MOCK_JSON_DEFAULT_FIELDS,
  MOCK_JSON_FIELD_TYPES,
  MOCK_JSON_RELATED_TOOLS
} from '../../constants/mock-json-generator.constants';
import type {
  MockJsonFieldType,
  MockJsonHistoryEntry
} from '../../types/mock-json-generator.types';
import {
  formatBytes,
  formatJsonString,
  formatRelativeTimestamp,
  generateMockJson,
  getFieldPlaceholder,
  prependMockJsonHistory,
  resolveMockJsonSuggestion,
  toHistoryFields
} from '../../utils/mock-json-generator.utils';

type FieldFormGroup = FormGroup<{
  key: FormControl<string>;
  type: FormControl<MockJsonFieldType>;
  value: FormControl<string>;
  arrayLength: FormControl<number>;
}>;

type MockJsonFormGroup = FormGroup<{
  fields: FormArray<FieldFormGroup>;
  arrayCount: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-mock-json-generator',
  standalone: true,
  templateUrl: './mock-json-generator.html',
  styleUrls: ['./mock-json-generator.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MockJsonGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: MockJsonFormGroup = this.fb.group({
    fields: this.fb.array<FieldFormGroup>(
      MOCK_JSON_DEFAULT_FIELDS.map((field) => this.createField(field.key, field.type, field.value))
    ),
    arrayCount: this.fb.control(MOCK_JSON_DEFAULT_ARRAY_COUNT, {
      nonNullable: true,
      validators: [Validators.min(MOCK_JSON_ARRAY_COUNT_MIN), Validators.max(MOCK_JSON_ARRAY_COUNT_MAX)]
    }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly fieldTypes = MOCK_JSON_FIELD_TYPES;
  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = MOCK_JSON_RELATED_TOOLS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly generatedJson = signal('');
  readonly history = signal<MockJsonHistoryEntry[]>([]);
  private readonly hasCopiedJson = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasGeneratedJson = computed(() => this.generatedJson().length > 0);
  readonly fieldsFormArray = computed(() => this.form.controls.fields);
  readonly formattedJson = computed(() => formatJsonString(this.generatedJson()));
  readonly primarySuggestion = computed(() => {
    const suggestion = resolveMockJsonSuggestion({
      hasGeneratedJson: this.hasGeneratedJson(),
      hasCopiedJson: this.hasCopiedJson(),
      arrayCount: this.form.controls.arrayCount.value,
      fieldTypes: this.form.controls.fields.getRawValue().map((field) => field.type),
      hasDuplicateWarning: this.warnings().some((message) => message.includes('Duplicate'))
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.dismissedSuggestionId.set(null);
        this.generateJson();
      });

    this.generateJson();
  }

  get fields(): FormArray<FieldFormGroup> {
    return this.form.controls.fields;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
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

    if (!this.form.controls.arrayCount.valid) {
      this.errors.set(['Number of objects must be between 1 and 100.']);
      return;
    }

    try {
      const { fields, arrayCount } = this.form.getRawValue();
      const result = generateMockJson(fields, arrayCount);
      this.warnings.set(result.warnings);

      if (result.error) {
        this.errors.set([result.error]);
        this.generatedJson.set('');
        return;
      }

      this.generatedJson.set(result.json);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(fields, result.json);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate JSON';
      this.errors.set([errorMessage]);
      this.generatedJson.set('');
    }
  }

  async copyToClipboard(text: string, label: string): Promise<void> {
    const ok = await ddCopyText(this.toast, text, label);
    if (ok) {
      this.hasCopiedJson.set(true);
      this.errors.set([]);
    } else {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  clear(): void {
    this.hasCopiedJson.set(false);
    this.dismissedSuggestionId.set(null);
    while (this.fields.length > 0) {
      this.fields.removeAt(0);
    }
    for (const field of MOCK_JSON_DEFAULT_FIELDS) {
      this.fields.push(this.createField(field.key, field.type, field.value));
    }
    this.form.patchValue({ arrayCount: MOCK_JSON_DEFAULT_ARRAY_COUNT });
    this.generatedJson.set('');
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: MockJsonHistoryEntry): void {
    while (this.fields.length > 0) {
      this.fields.removeAt(0);
    }

    for (const field of entry.fields) {
      this.fields.push(
        this.createField(field.key, field.type, field.value || '', field.arrayLength || MOCK_JSON_DEFAULT_ARRAY_LENGTH)
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

  getFieldPlaceholder(type: MockJsonFieldType): string {
    return getFieldPlaceholder(type);
  }

  formatBytes(bytes: number): string {
    return formatBytes(bytes);
  }

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  private createField(
    key = '',
    type: MockJsonFieldType = 'string',
    value = '',
    arrayLength = MOCK_JSON_DEFAULT_ARRAY_LENGTH
  ): FieldFormGroup {
    return this.fb.group({
      key: this.fb.control(key, { nonNullable: true }),
      type: this.fb.control<MockJsonFieldType>(type, { nonNullable: true }),
      value: this.fb.control(type === 'array' && !value ? 'string' : value, { nonNullable: true }),
      arrayLength: this.fb.control(arrayLength, {
        nonNullable: true,
        validators: [Validators.min(MOCK_JSON_ARRAY_COUNT_MIN), Validators.max(MOCK_JSON_ARRAY_COUNT_MAX)]
      })
    });
  }

  private addToHistory(
    fields: Array<{ key: string; type: MockJsonFieldType; value: string; arrayLength: number }>,
    json: string
  ): void {
    const entry: MockJsonHistoryEntry = {
      timestamp: Date.now(),
      fields: toHistoryFields(fields),
      generatedJson: json
    };

    this.history.update((entries) => prependMockJsonHistory(entries, entry));
  }
}
