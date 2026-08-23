import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface ConversionResult {
  input: number;
  output: number;
  formula: string;
}

interface HistoryEntry {
  timestamp: number;
  input: number;
  output: number;
  direction: 'px-to-rem' | 'rem-to-px';
  baseSize: number;
}

type PixelRemFormGroup = FormGroup<{
  direction: FormControl<'px-to-rem' | 'rem-to-px'>;
  inputValue: FormControl<number>;
  baseSize: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

const COMMON_SIZES = [
  { px: 8, rem: 0.5 },
  { px: 10, rem: 0.625 },
  { px: 12, rem: 0.75 },
  { px: 14, rem: 0.875 },
  { px: 16, rem: 1 },
  { px: 18, rem: 1.125 },
  { px: 20, rem: 1.25 },
  { px: 24, rem: 1.5 },
  { px: 32, rem: 2 },
  { px: 40, rem: 2.5 },
  { px: 48, rem: 3 },
  { px: 64, rem: 4 }
];

@Component({
  selector: 'lib-pixel-to-rem',
  standalone: true,
  templateUrl: './pixel-to-rem.html',
  styleUrls: ['./pixel-to-rem.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PixelToRemComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly form: PixelRemFormGroup = this.fb.group({
    direction: this.fb.control<'px-to-rem' | 'rem-to-px'>('px-to-rem', { nonNullable: true }),
    inputValue: this.fb.control(16, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)]
    }),
    baseSize: this.fb.control(16, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)]
    }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly commonSizes = COMMON_SIZES;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly conversionResult = computed(() => this.calculateConversion());
  readonly hasResult = computed(() => this.conversionResult() !== null);

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateHistory();
      });

    // Initial calculation
    this.updateHistory();
  }

  calculateConversion(): ConversionResult | null {
    const { direction, inputValue, baseSize } = this.form.getRawValue();

    if (inputValue === null || inputValue === undefined || isNaN(inputValue)) {
      return null;
    }

    let output: number;
    let formula: string;

    if (direction === 'px-to-rem') {
      output = inputValue / baseSize;
      formula = `${inputValue}px ÷ ${baseSize}px = ${output.toFixed(4)}rem`;
    } else {
      output = inputValue * baseSize;
      formula = `${inputValue}rem × ${baseSize}px = ${output.toFixed(2)}px`;
    }

    return {
      input: inputValue,
      output,
      formula
    };
  }

  applyCommonSize(size: { px: number; rem: number }): void {
    const direction = this.form.controls.direction.value;
    if (direction === 'px-to-rem') {
      this.form.patchValue({ inputValue: size.px });
    } else {
      this.form.patchValue({ inputValue: size.rem });
    }
  }

  swapDirection(): void {
    const currentDirection = this.form.controls.direction.value;
    const newDirection = currentDirection === 'px-to-rem' ? 'rem-to-px' : 'px-to-rem';
    this.form.patchValue({ direction: newDirection });
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
    this.form.patchValue({
      inputValue: 16,
      baseSize: 16
    });
    this.errors.set([]);
    this.warnings.set([]);
  }

  applyHistory(entry: HistoryEntry): void {
    this.form.patchValue({
      direction: entry.direction,
      inputValue: entry.input,
      baseSize: entry.baseSize
    });
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  private updateHistory(): void {
    if (!this.form.controls.rememberHistory.value) {
      return;
    }

    const result = this.calculateConversion();
    if (!result) {
      return;
    }

    const { direction, inputValue, baseSize } = this.form.getRawValue();

    const entry: HistoryEntry = {
      timestamp: Date.now(),
      input: inputValue,
      output: result.output,
      direction,
      baseSize
    };

    this.history.update((entries) => {
      const exists = entries.some(
        (e) => e.input === entry.input && e.direction === entry.direction && e.baseSize === entry.baseSize
      );
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  formatOutput(value: number): string {
    // Format with appropriate decimal places
    if (value % 1 === 0) {
      return value.toString();
    }
    // For rem, show up to 4 decimal places
    if (this.form.controls.direction.value === 'px-to-rem') {
      return value.toFixed(4).replace(/\.?0+$/, '');
    }
    // For px, show up to 2 decimal places
    return value.toFixed(2).replace(/\.?0+$/, '');
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
