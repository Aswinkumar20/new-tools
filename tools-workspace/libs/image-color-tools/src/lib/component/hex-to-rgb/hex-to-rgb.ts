import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

interface ColorResult {
  hex: string;
  rgb: { r: number; g: number; b: number };
  rgba: { r: number; g: number; b: number; a: number };
  hsl: { h: number; s: number; l: number };
  hsla: { h: number; s: number; l: number; a: number };
  valid: boolean;
}

interface HistoryEntry {
  timestamp: number;
  hex: string;
  rgb: string;
}

type ColorFormGroup = FormGroup<{
  hex: FormControl<string>;
  red: FormControl<number | null>;
  green: FormControl<number | null>;
  blue: FormControl<number | null>;
  alpha: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-hex-to-rgb',
  standalone: true,
  templateUrl: './hex-to-rgb.html',
  styleUrls: ['./hex-to-rgb.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HexToRgbComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: ColorFormGroup = this.fb.group({
    hex: this.fb.control<string>('#007bff', {
      nonNullable: true,
      validators: [Validators.required, this.hexValidator]
    }),
    red: this.fb.control<number | null>(0, {
      validators: [Validators.min(0), Validators.max(255)]
    }),
    green: this.fb.control<number | null>(123, {
      validators: [Validators.min(0), Validators.max(255)]
    }),
    blue: this.fb.control<number | null>(255, {
      validators: [Validators.min(0), Validators.max(255)]
    }),
    alpha: this.fb.control<number>(1, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(1)]
    }),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly result: WritableSignal<ColorResult | null> = signal(null);
  readonly errors = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);
  readonly inputMode = signal<'hex' | 'rgb'>('hex');

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly isValidColor = computed(() => this.result()?.valid ?? false);

  constructor() {
    this.form.controls.hex.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.inputMode() === 'hex') {
          this.convertFromHex();
        }
      });

    this.form.controls.red.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.inputMode() === 'rgb') {
          this.convertFromRgb();
        }
      });

    this.form.controls.green.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.inputMode() === 'rgb') {
          this.convertFromRgb();
        }
      });

    this.form.controls.blue.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.inputMode() === 'rgb') {
          this.convertFromRgb();
        }
      });

    this.form.controls.alpha.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.inputMode() === 'rgb') {
          this.convertFromRgb();
        } else {
          this.convertFromHex();
        }
      });

    // Initial conversion
    this.convertFromHex();
  }

  onHexInput(): void {
    this.inputMode.set('hex');
    this.convertFromHex();
  }

  onRgbInput(): void {
    this.inputMode.set('rgb');
    this.convertFromRgb();
  }

  convertFromHex(): void {
    this.errors.set([]);
    const hexValue = this.form.controls.hex.value.trim();
    const alpha = this.form.controls.alpha.value ?? 1;

    if (!hexValue) {
      this.result.set(null);
      return;
    }

    const normalized = this.normalizeHex(hexValue);
    if (!normalized) {
      this.errors.set(['Invalid HEX color format. Use #RRGGBB or #RGB.']);
      this.result.set(null);
      return;
    }

    const rgb = this.hexToRgb(normalized);
    if (!rgb) {
      this.errors.set(['Unable to parse HEX color.']);
      this.result.set(null);
      return;
    }

    const hslaResult = this.rgbToHsl(rgb, alpha);
    const result: ColorResult = {
      hex: normalized,
      rgb: { r: rgb.r, g: rgb.g, b: rgb.b },
      rgba: { r: rgb.r, g: rgb.g, b: rgb.b, a: alpha },
      hsl: { h: hslaResult.h, s: hslaResult.s, l: hslaResult.l },
      hsla: hslaResult,
      valid: true
    };

    this.result.set(result);

    // Update RGB form controls without triggering conversion
    this.form.patchValue(
      {
        red: rgb.r,
        green: rgb.g,
        blue: rgb.b
      },
      { emitEvent: false }
    );

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(result);
    }
  }

  convertFromRgb(): void {
    this.errors.set([]);
    const red = this.form.controls.red.value;
    const green = this.form.controls.green.value;
    const blue = this.form.controls.blue.value;
    const alpha = this.form.controls.alpha.value ?? 1;

    if (red === null || green === null || blue === null) {
      this.result.set(null);
      return;
    }

    if (red < 0 || red > 255 || green < 0 || green > 255 || blue < 0 || blue > 255) {
      this.errors.set(['RGB values must be between 0 and 255.']);
      this.result.set(null);
      return;
    }

    const hex = this.rgbToHex({ r: red, g: green, b: blue });
    const rgb = { r: red, g: green, b: blue };
    const hslaResult = this.rgbToHsl(rgb, alpha);

    const result: ColorResult = {
      hex,
      rgb,
      rgba: { r: red, g: green, b: blue, a: alpha },
      hsl: { h: hslaResult.h, s: hslaResult.s, l: hslaResult.l },
      hsla: hslaResult,
      valid: true
    };

    this.result.set(result);

    // Update HEX form control without triggering conversion
    this.form.patchValue({ hex }, { emitEvent: false });

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(result);
    }
  }

  copyToClipboard(value: string, label: string): void {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        // Could show a toast notification here
      })
      .catch(() => {
        this.errors.set([`Unable to copy ${label} to clipboard.`]);
      });
  }

  clear(): void {
    this.form.patchValue({
      hex: '#007bff',
      red: 0,
      green: 123,
      blue: 255,
      alpha: 1
    });
    this.result.set(null);
    this.errors.set([]);
    this.inputMode.set('hex');
    this.convertFromHex();
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  applyHistory(entry: HistoryEntry): void {
    this.form.patchValue({ hex: entry.hex });
    this.inputMode.set('hex');
    this.convertFromHex();
  }

  onColorPickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.form.patchValue({ hex: input.value });
      this.inputMode.set('hex');
      this.convertFromHex();
    }
  }

  private normalizeHex(hex: string): string | null {
    let cleaned = hex.replace(/^#/, '').trim();
    if (cleaned.length === 3) {
      cleaned = cleaned
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (cleaned.length !== 6) {
      return null;
    }
    if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
      return null;
    }
    return '#' + cleaned.toUpperCase();
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const match = hex.match(/^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);
    if (!match) {
      return null;
    }
    return {
      r: Number.parseInt(match[1], 16),
      g: Number.parseInt(match[2], 16),
      b: Number.parseInt(match[3], 16)
    };
  }

  private rgbToHex(rgb: { r: number; g: number; b: number }): string {
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16).padStart(2, '0');
      return hex.toUpperCase();
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  private rgbToHsl(rgb: { r: number; g: number; b: number }, alpha: number = 1): {
    h: number;
    s: number;
    l: number;
    a: number;
  } {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const delta = max - min;
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / delta + 2) / 6;
          break;
        case b:
          h = ((r - g) / delta + 4) / 6;
          break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
      a: alpha
    };
  }

  private addToHistory(result: ColorResult): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      hex: result.hex,
      rgb: `rgb(${result.rgb.r}, ${result.rgb.g}, ${result.rgb.b})`
    };
    this.history.update((entries) => [entry, ...entries].slice(0, 10));
  }

  private hexValidator(control: FormControl<string>): { [key: string]: any } | null {
    const value = control.value?.trim() || '';
    if (!value) {
      return null;
    }
    const cleaned = value.replace(/^#/, '');
    if (cleaned.length === 3 || cleaned.length === 6) {
      if (/^[0-9A-Fa-f]+$/.test(cleaned)) {
        return null;
      }
    }
    return { invalidHex: true };
  }
}
