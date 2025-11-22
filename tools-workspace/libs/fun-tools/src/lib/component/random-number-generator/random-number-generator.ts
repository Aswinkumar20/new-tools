import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

interface GeneratedNumber {
  value: number;
  timestamp: number;
}

type RandomFormGroup = FormGroup<{
  min: FormControl<number>;
  max: FormControl<number>;
  count: FormControl<number>;
  integerOnly: FormControl<boolean>;
  decimals: FormControl<number>;
}>;

@Component({
  selector: 'lib-random-number-generator',
  standalone: true,
  templateUrl: './random-number-generator.html',
  styleUrls: ['./random-number-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RandomNumberGeneratorComponent {
  private readonly fb = inject(FormBuilder);

  readonly form: RandomFormGroup = this.fb.group({
    min: this.fb.control(1, { nonNullable: true }),
    max: this.fb.control(100, { nonNullable: true }),
    count: this.fb.control(1, { nonNullable: true }),
    integerOnly: this.fb.control(true, { nonNullable: true }),
    decimals: this.fb.control(2, { nonNullable: true })
  });

  readonly generatedNumbers = signal<GeneratedNumber[]>([]);
  readonly errors = signal<string[]>([]);

  readonly hasResults = computed(() => this.generatedNumbers().length > 0);
  readonly stats = computed(() => {
    const numbers = this.generatedNumbers();
    if (numbers.length === 0) {
      return { count: 0, min: 0, max: 0, average: 0, sum: 0 };
    }

    const values = numbers.map((n) => n.value);
    const sum = values.reduce((acc, val) => acc + val, 0);
    return {
      count: numbers.length,
      min: Math.min(...values),
      max: Math.max(...values),
      average: sum / values.length,
      sum
    };
  });

  readonly latestResults = computed(() => {
    const count = this.form.controls.count.value;
    return this.generatedNumbers().slice(0, count);
  });

  constructor() {
    // Subscribe to integerOnly changes to update decimals
    this.form.controls.integerOnly.valueChanges.subscribe((isInteger) => {
      if (isInteger) {
        this.form.controls.decimals.setValue(0);
      }
    });
  }

  generate(): void {
    this.errors.set([]);
    const { min, max, count, integerOnly, decimals } = this.form.getRawValue();

    if (min >= max) {
      this.errors.set(['Minimum value must be less than maximum value.']);
      return;
    }

    if (count < 1 || count > 1000) {
      this.errors.set(['Count must be between 1 and 1000.']);
      return;
    }

    if (!integerOnly && (decimals < 0 || decimals > 10)) {
      this.errors.set(['Decimal places must be between 0 and 10.']);
      return;
    }

    const numbers: GeneratedNumber[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < count; i++) {
      let value: number;

      if (integerOnly) {
        value = Math.floor(Math.random() * (max - min + 1)) + min;
      } else {
        const random = Math.random() * (max - min) + min;
        const multiplier = Math.pow(10, decimals);
        value = Math.round(random * multiplier) / multiplier;
      }

      numbers.push({ value, timestamp: timestamp + i });
    }

    this.generatedNumbers.update((current) => [...numbers, ...current].slice(0, 100));
  }

  clearResults(): void {
    this.generatedNumbers.set([]);
    this.errors.set([]);
  }

  copyResults(): void {
    const numbers = this.latestResults();
    if (numbers.length === 0) {
      return;
    }

    const text = numbers.map((n) => n.value.toString()).join(', ');
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Success - could show a toast notification
      })
      .catch(() => {
        this.errors.set(['Failed to copy to clipboard.']);
      });
  }

  copySingle(value: number): void {
    navigator.clipboard
      .writeText(value.toString())
      .then(() => {
        // Success
      })
      .catch(() => {
        this.errors.set(['Failed to copy to clipboard.']);
      });
  }

  formatNumber(value: number): string {
    const { integerOnly, decimals } = this.form.getRawValue();
    if (integerOnly) {
      return value.toString();
    }
    return value.toFixed(decimals);
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
}
