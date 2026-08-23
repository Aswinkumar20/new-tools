import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService, StatValueTooltipHostDirective } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  PIXEL_REM_BASE_MAX,
  PIXEL_REM_BASE_MIN,
  PIXEL_REM_COMMON_SIZES,
  PIXEL_REM_DEFAULT_BASE,
  PIXEL_REM_DEFAULT_INPUT,
  PIXEL_REM_INPUT_MIN,
  PIXEL_REM_RELATED_TOOLS
} from '../../constants/pixel-to-rem.constants';
import type {
  PixelRemCommonSize,
  PixelRemDirection,
  PixelRemHistoryEntry
} from '../../types/pixel-to-rem.types';
import {
  calculatePixelRemConversion,
  formatPixelRemOutput,
  formatRelativeTimestamp,
  prependPixelRemHistory,
  pxToRem,
  resolvePixelRemSuggestion,
  validatePixelRemInputs
} from '../../utils/pixel-to-rem.utils';

type PixelRemFormGroup = FormGroup<{
  direction: FormControl<PixelRemDirection>;
  inputValue: FormControl<number>;
  baseSize: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-pixel-to-rem',
  standalone: true,
  templateUrl: './pixel-to-rem.html',
  styleUrls: ['./pixel-to-rem.scss'],
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PixelToRemComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: PixelRemFormGroup = this.fb.group({
    direction: this.fb.control<PixelRemDirection>('px-to-rem', { nonNullable: true }),
    inputValue: this.fb.control(PIXEL_REM_DEFAULT_INPUT, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(PIXEL_REM_INPUT_MIN)]
    }),
    baseSize: this.fb.control(PIXEL_REM_DEFAULT_BASE, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(PIXEL_REM_BASE_MIN),
        Validators.max(PIXEL_REM_BASE_MAX)
      ]
    }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly commonSizes = PIXEL_REM_COMMON_SIZES;
  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = PIXEL_REM_RELATED_TOOLS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly history = signal<PixelRemHistoryEntry[]>([]);
  private readonly formTick = signal(0);
  private readonly hasCopiedResult = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly conversionResult = computed(() => {
    this.formTick();
    if (!this.form.controls.inputValue.valid || !this.form.controls.baseSize.valid) {
      return null;
    }
    return calculatePixelRemConversion(this.form.getRawValue());
  });
  readonly hasResult = computed(() => this.conversionResult() !== null);
  readonly primarySuggestion = computed(() => {
    this.formTick();
    const suggestion = resolvePixelRemSuggestion({
      values: this.form.getRawValue(),
      hasResult: this.hasResult(),
      hasCopiedResult: this.hasCopiedResult()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(50), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formTick.update((n) => n + 1);
        this.dismissedSuggestionId.set(null);
        this.validateInputs();
        this.updateHistory();
      });

    this.formTick.update((n) => n + 1);
    this.updateHistory();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  getCommonSizeRem(px: number): number {
    return pxToRem(px, this.form.controls.baseSize.value || PIXEL_REM_DEFAULT_BASE);
  }

  loadExample(): void {
    this.applyCommonSize({ px: 24, rem: 1.5, label: 'H5 / lead' });
  }

  applyCommonSize(size: PixelRemCommonSize): void {
    const direction = this.form.controls.direction.value;
    if (direction === 'px-to-rem') {
      this.form.patchValue({ inputValue: size.px });
    } else {
      this.form.patchValue({ inputValue: this.getCommonSizeRem(size.px) });
    }
    this.refreshDerivedState();
  }

  swapDirection(): void {
    const current = this.conversionResult();
    const currentDirection = this.form.controls.direction.value;
    const newDirection = currentDirection === 'px-to-rem' ? 'rem-to-px' : 'px-to-rem';
    this.form.patchValue({
      direction: newDirection,
      inputValue: current
        ? Number(formatPixelRemOutput(current.output, currentDirection))
        : this.form.controls.inputValue.value
    });
    this.refreshDerivedState();
  }

  async copyToClipboard(text: string, label: string): Promise<void> {
    const ok = await ddCopyText(this.toast, text, label);
    if (ok) {
      this.hasCopiedResult.set(true);
      this.errors.set([]);
    } else {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  clear(): void {
    this.hasCopiedResult.set(false);
    this.dismissedSuggestionId.set(null);
    this.form.patchValue({
      inputValue: PIXEL_REM_DEFAULT_INPUT,
      baseSize: PIXEL_REM_DEFAULT_BASE
    });
    this.errors.set([]);
    this.warnings.set([]);
    this.refreshDerivedState();
  }

  applyHistory(entry: PixelRemHistoryEntry): void {
    this.form.patchValue({
      direction: entry.direction,
      inputValue: entry.input,
      baseSize: entry.baseSize
    });
    this.refreshDerivedState();
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  formatOutput(value: number): string {
    return formatPixelRemOutput(value, this.form.controls.direction.value);
  }

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  private refreshDerivedState(): void {
    this.formTick.update((n) => n + 1);
    this.validateInputs();
    this.updateHistory();
  }

  private validateInputs(): void {
    this.errors.set(
      validatePixelRemInputs({
        inputValid: this.form.controls.inputValue.valid,
        baseValid: this.form.controls.baseSize.valid
      })
    );
  }

  private updateHistory(): void {
    if (!this.form.controls.rememberHistory.value) {
      return;
    }

    const result = calculatePixelRemConversion(this.form.getRawValue());
    if (!result) {
      return;
    }

    const { direction, inputValue, baseSize } = this.form.getRawValue();
    const entry: PixelRemHistoryEntry = {
      timestamp: Date.now(),
      input: inputValue,
      output: result.output,
      direction,
      baseSize
    };

    this.history.update((entries) => prependPixelRemHistory(entries, entry));
  }
}
