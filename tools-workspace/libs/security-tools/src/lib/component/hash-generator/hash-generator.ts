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
import type { StRelatedToolLink } from '../../shared/st-tool-suggestion.model';
import { stCopyText } from '../../shared/st-clipboard.util';
import {
  HASH_ALGORITHM_OPTIONS,
  HASH_DEFAULT_FORM,
  HASH_OUTPUT_FORMAT_OPTIONS,
  HASH_RELATED_TOOLS
} from '../../constants/hash-generator.constants';
import type {
  HashAlgorithm,
  HashGeneratorFormGroup,
  HashGeneratorFormValues,
  HashOutputFormat,
  HashResult
} from '../../types/hash-generator.types';
import {
  computeHashResult,
  formatHashHex,
  formatHashOutputText,
  resolveHashSuggestion
} from '../../utils/hash-generator.utils';

@Component({
  selector: 'lib-hash-generator',
  standalone: true,
  templateUrl: './hash-generator.html',
  styleUrls: ['./hash-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HashGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly algorithmOptions = HASH_ALGORITHM_OPTIONS;
  readonly outputFormatOptions = HASH_OUTPUT_FORMAT_OPTIONS;
  readonly relatedTools: ReadonlyArray<StRelatedToolLink> = HASH_RELATED_TOOLS;

  readonly form: HashGeneratorFormGroup = this.fb.group({
    input: this.fb.control(HASH_DEFAULT_FORM.input, { nonNullable: true }),
    algorithm: this.fb.control<HashAlgorithm>(HASH_DEFAULT_FORM.algorithm, {
      nonNullable: true
    }),
    uppercase: this.fb.control(HASH_DEFAULT_FORM.uppercase, { nonNullable: true }),
    outputFormat: this.fb.control<HashOutputFormat>(HASH_DEFAULT_FORM.outputFormat, {
      nonNullable: true
    })
  });

  readonly errors = signal<string[]>([]);
  readonly result = signal<HashResult | null>(null);
  readonly formSnapshot = signal<HashGeneratorFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasResult = computed(() => this.result() !== null);
  readonly hasInput = computed(() => !!this.formSnapshot().input.trim());

  readonly displayHex = computed(() => {
    const res = this.result();
    if (!res) {
      return '';
    }
    return formatHashHex(res.hex, this.formSnapshot().uppercase);
  });

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveHashSuggestion({
      hasInput: this.hasInput(),
      hasResult: this.hasResult(),
      hasError: this.errors().length > 0,
      algorithm: this.formSnapshot().algorithm,
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
  }

  async generate(): Promise<void> {
    this.errors.set([]);
    this.result.set(null);
    this.dismissedSuggestionId.set(null);

    const { input, algorithm } = this.form.getRawValue();
    const { result, errors } = await computeHashResult(input ?? '', algorithm);

    this.errors.set(errors);
    this.result.set(result);
  }

  clear(): void {
    this.form.controls.input.setValue('');
    this.result.set(null);
    this.errors.set([]);
    this.dismissedSuggestionId.set(null);
    this.toast.info('Cleared');
  }

  async copyInput(): Promise<void> {
    await stCopyText(this.toast, this.form.controls.input.value, 'Input');
  }

  async copyOutput(): Promise<void> {
    const r = this.result();
    if (!r) {
      return;
    }
    const snapshot = this.formSnapshot();
    const text = formatHashOutputText(r, snapshot.outputFormat, snapshot.uppercase);
    const label =
      snapshot.outputFormat === 'hex'
        ? 'Hex hash'
        : snapshot.outputFormat === 'base64'
          ? 'Base64 hash'
          : 'Hash output';
    await stCopyText(this.toast, text, label);
  }

  async copyHex(): Promise<void> {
    await stCopyText(this.toast, this.displayHex(), 'Hex hash');
  }

  async copyBase64(): Promise<void> {
    const r = this.result();
    if (r) {
      await stCopyText(this.toast, r.base64, 'Base64 hash');
    }
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): HashGeneratorFormValues {
    const raw = this.form.getRawValue();
    return {
      input: raw.input,
      algorithm: raw.algorithm,
      uppercase: raw.uppercase,
      outputFormat: raw.outputFormat
    };
  }
}
