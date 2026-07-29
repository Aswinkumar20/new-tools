import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Navigation,
  TooltipDirective,
  AssetService,
  ToastService
} from '@tools-workspace/features-home';
import type { TtRelatedToolLink } from '../../shared/tt-tool-suggestion.model';
import { ttCopyText } from '../../shared/tt-clipboard.util';
import {
  JSON_SCHEMA_DEFAULT_FORM,
  JSON_SCHEMA_RELATED_TOOLS
} from '../../constants/json-schema-validator.constants';
import type {
  JsonSchemaDraft,
  JsonSchemaFormGroup,
  JsonSchemaFormValues,
  JsonSchemaValidationResult
} from '../../types/json-schema-validator.types';
import {
  resolveJsonSchemaSuggestion,
  validateJsonSchemaDocument
} from '../../utils/json-schema-validator.utils';

@Component({
  selector: 'lib-json-schema-validator',
  standalone: true,
  templateUrl: './json-schema-validator.html',
  styleUrls: ['./json-schema-validator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JsonSchemaValidatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<TtRelatedToolLink> = JSON_SCHEMA_RELATED_TOOLS;

  readonly form: JsonSchemaFormGroup = this.fb.group({
    schema: this.fb.control(JSON_SCHEMA_DEFAULT_FORM.schema, { nonNullable: true }),
    data: this.fb.control(JSON_SCHEMA_DEFAULT_FORM.data, { nonNullable: true }),
    draft: this.fb.control<JsonSchemaDraft>(JSON_SCHEMA_DEFAULT_FORM.draft, {
      nonNullable: true
    }),
    strictTypes: this.fb.control(JSON_SCHEMA_DEFAULT_FORM.strictTypes, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result = signal<JsonSchemaValidationResult | null>(null);
  readonly formSnapshot = signal<JsonSchemaFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasResult = computed(() => this.result() !== null);
  readonly isValid = computed(() => !!this.result() && this.result()!.valid);
  readonly issues = computed(() => this.result()?.issues ?? []);

  readonly hasInput = computed(() => {
    const snapshot = this.formSnapshot();
    return !!snapshot.schema.trim() || !!snapshot.data.trim();
  });

  readonly hasSchema = computed(() => !!this.formSnapshot().schema.trim());
  readonly hasData = computed(() => !!this.formSnapshot().data.trim());

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveJsonSchemaSuggestion({
      hasSchema: this.hasSchema(),
      hasData: this.hasData(),
      hasResult: this.hasResult(),
      isValid: this.isValid(),
      issueCount: this.issues().length,
      errorMessage: this.errors()[0] ?? null
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.readFormValues());
    });

    if (this.form.controls.schema.value.trim() && this.form.controls.data.value.trim()) {
      this.validate();
    }
  }

  onInputChange(): void {
    this.formSnapshot.set(this.readFormValues());
    if (this.form.controls.schema.value.trim() && this.form.controls.data.value.trim()) {
      this.validate();
    } else {
      this.result.set(null);
      this.errors.set([]);
    }
  }

  onOptionChange(): void {
    this.formSnapshot.set(this.readFormValues());
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
    this.dismissedSuggestionId.set(null);
    this.formSnapshot.set(this.readFormValues());
    this.toast.info('Cleared');
  }

  async copySchema(): Promise<void> {
    await ttCopyText(this.toast, this.form.controls.schema.value, 'Schema');
  }

  async copyData(): Promise<void> {
    await ttCopyText(this.toast, this.form.controls.data.value, 'Data');
  }

  validate(): void {
    this.dismissedSuggestionId.set(null);
    const { schema, data, strictTypes } = this.form.getRawValue();
    const { result, errors } = validateJsonSchemaDocument({ schema, data, strictTypes });
    this.errors.set(errors);
    this.warnings.set([]);
    this.result.set(result);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): JsonSchemaFormValues {
    return this.form.getRawValue();
  }
}
