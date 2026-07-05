import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, WritableSignal, computed, inject, signal } from '@angular/core';
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

interface ColorPreset {
  label: string;
  hex: string;
}

type ColorFormGroup = FormGroup<{
  hex: FormControl<string>;
  red: FormControl<number | null>;
  green: FormControl<number | null>;
  blue: FormControl<number | null>;
  hue: FormControl<number | null>;
  saturation: FormControl<number | null>;
  lightness: FormControl<number | null>;
  alpha: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

const COLOR_PRESETS: ColorPreset[] = [
  { label: 'Blue', hex: '#007bff' },
  { label: 'Indigo', hex: '#6610f2' },
  { label: 'Purple', hex: '#6f42c1' },
  { label: 'Pink', hex: '#e83e8c' },
  { label: 'Red', hex: '#dc3545' },
  { label: 'Orange', hex: '#fd7e14' },
  { label: 'Yellow', hex: '#ffc107' },
  { label: 'Green', hex: '#28a745' },
  { label: 'Teal', hex: '#20c997' },
  { label: 'Cyan', hex: '#17a2b8' },
  { label: 'White', hex: '#ffffff' },
  { label: 'Gray', hex: '#6c757d' },
  { label: 'Dark Gray', hex: '#343a40' },
  { label: 'Black', hex: '#000000' }
];

@Component({
  selector: 'lib-color-picker',
  standalone: true,
  templateUrl: './color-picker.html',
  styleUrls: ['./color-picker.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ColorPickerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  @ViewChild('pickerCanvas', { static: false }) pickerCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('hueCanvas', { static: false }) hueCanvas!: ElementRef<HTMLCanvasElement>;

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
    hue: this.fb.control<number | null>(214, {
      validators: [Validators.min(0), Validators.max(360)]
    }),
    saturation: this.fb.control<number | null>(100, {
      validators: [Validators.min(0), Validators.max(100)]
    }),
    lightness: this.fb.control<number | null>(50, {
      validators: [Validators.min(0), Validators.max(100)]
    }),
    alpha: this.fb.control<number>(1, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(1)]
    }),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly presets = COLOR_PRESETS;
  readonly result: WritableSignal<ColorResult | null> = signal(null);
  readonly errors = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);
  readonly isPickerActive = signal(false);
  readonly isHueActive = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly isValidColor = computed(() => this.result()?.valid ?? false);
  readonly currentHue = computed(() => this.form.controls.hue.value ?? 214);

  private currentRgb = { r: 0, g: 123, b: 255 };

  constructor() {
    this.form.controls.hex.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.convertFromHex());

    this.form.controls.red.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.convertFromRgb());

    this.form.controls.green.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.convertFromRgb());

    this.form.controls.blue.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.convertFromRgb());

    this.form.controls.hue.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.convertFromHsl());

    this.form.controls.saturation.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.convertFromHsl());

    this.form.controls.lightness.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.convertFromHsl());

    this.form.controls.alpha.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.result()) {
          this.updateAlpha();
        }
      });

    // Initial conversion
    setTimeout(() => {
      this.initCanvases();
      this.convertFromHex();
    }, 0);
  }

  initCanvases(): void {
    this.drawPickerCanvas();
    this.drawHueCanvas();
  }

  drawPickerCanvas(): void {
    const canvas = this.pickerCanvas?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const hue = this.currentHue();

    // Create gradient from white to black (top to bottom)
    const whiteToBlack = ctx.createLinearGradient(0, 0, 0, height);
    whiteToBlack.addColorStop(0, 'rgba(255, 255, 255, 1)');
    whiteToBlack.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = whiteToBlack;
    ctx.fillRect(0, 0, width, height);

    // Create gradient from transparent to full hue (left to right)
    const hueColor = this.hslToRgb(hue, 100, 50);
    const transparentToHue = ctx.createLinearGradient(0, 0, width, 0);
    transparentToHue.addColorStop(0, 'rgba(255, 255, 255, 0)');
    transparentToHue.addColorStop(1, `rgb(${hueColor.r}, ${hueColor.g}, ${hueColor.b})`);
    ctx.fillStyle = transparentToHue;
    ctx.fillRect(0, 0, width, height);
  }

  drawHueCanvas(): void {
    const canvas = this.hueCanvas?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Draw hue spectrum
    for (let i = 0; i < height; i++) {
      const hue = (i / height) * 360;
      const rgb = this.hslToRgb(hue, 100, 50);
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.fillRect(0, i, width, 1);
    }
  }

  onPickerClick(event: MouseEvent | KeyboardEvent): void {
    if (event instanceof KeyboardEvent) {
      return; // Keyboard events handled separately if needed
    }
    const canvas = this.pickerCanvas?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(x, y, 1, 1);
    const [r, g, b] = imageData.data;

    this.currentRgb = { r, g, b };
    this.updateFromRgb();
  }

  onPickerDrag(event: MouseEvent): void {
    if (this.isPickerActive()) {
      this.onPickerClick(event);
    }
  }

  onHueClick(event: MouseEvent | KeyboardEvent): void {
    if (event instanceof KeyboardEvent) {
      return; // Keyboard events handled separately if needed
    }
    const canvas = this.hueCanvas?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const hue = Math.round((y / canvas.height) * 360);

    this.form.patchValue({ hue }, { emitEvent: false });
    this.drawPickerCanvas();
    this.convertFromHsl();
  }

  onHueDrag(event: MouseEvent): void {
    if (this.isHueActive()) {
      this.onHueClick(event);
    }
  }

  onColorInputChange(): void {
    this.convertFromHex();
  }

  applyPreset(preset: ColorPreset): void {
    this.form.patchValue({ hex: preset.hex });
    this.convertFromHex();
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

    this.currentRgb = rgb;
    const hsl = this.rgbToHsl(rgb);
    const hsla = { ...hsl, a: alpha };

    const result: ColorResult = {
      hex: normalized,
      rgb,
      rgba: { ...rgb, a: alpha },
      hsl,
      hsla,
      valid: true
    };

    this.result.set(result);

    // Update form controls without triggering conversion
    this.form.patchValue(
      {
        red: rgb.r,
        green: rgb.g,
        blue: rgb.b,
        hue: hsl.h,
        saturation: hsl.s,
        lightness: hsl.l
      },
      { emitEvent: false }
    );

    this.drawPickerCanvas();

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

    this.currentRgb = { r: red, g: green, b: blue };
    this.updateFromRgb();
  }

  convertFromHsl(): void {
    this.errors.set([]);
    const hue = this.form.controls.hue.value;
    const saturation = this.form.controls.saturation.value;
    const lightness = this.form.controls.lightness.value;
    const alpha = this.form.controls.alpha.value ?? 1;

    if (hue === null || saturation === null || lightness === null) {
      this.result.set(null);
      return;
    }

    if (hue < 0 || hue > 360 || saturation < 0 || saturation > 100 || lightness < 0 || lightness > 100) {
      this.errors.set(['HSL values must be within valid ranges.']);
      this.result.set(null);
      return;
    }

    const rgb = this.hslToRgb(hue, saturation, lightness);
    this.currentRgb = rgb;
    const hsl = { h: hue, s: saturation, l: lightness };
    const hsla = { ...hsl, a: alpha };
    const hex = this.rgbToHex(rgb);

    const result: ColorResult = {
      hex,
      rgb,
      rgba: { ...rgb, a: alpha },
      hsl,
      hsla,
      valid: true
    };

    this.result.set(result);

    // Update form controls without triggering conversion
    this.form.patchValue(
      {
        hex,
        red: rgb.r,
        green: rgb.g,
        blue: rgb.b
      },
      { emitEvent: false }
    );

    this.drawPickerCanvas();

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(result);
    }
  }

  updateFromRgb(): void {
    const alpha = this.form.controls.alpha.value ?? 1;
    const hsl = this.rgbToHsl(this.currentRgb);
    const hsla = { ...hsl, a: alpha };
    const hex = this.rgbToHex(this.currentRgb);

    const result: ColorResult = {
      hex,
      rgb: this.currentRgb,
      rgba: { ...this.currentRgb, a: alpha },
      hsl,
      hsla,
      valid: true
    };

    this.result.set(result);

    // Update form controls without triggering conversion
    this.form.patchValue(
      {
        hex,
        hue: hsl.h,
        saturation: hsl.s,
        lightness: hsl.l
      },
      { emitEvent: false }
    );

    this.drawPickerCanvas();

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(result);
    }
  }

  updateAlpha(): void {
    const current = this.result();
    if (!current) return;

    const alpha = this.form.controls.alpha.value ?? 1;
    const updated: ColorResult = {
      ...current,
      rgba: { ...current.rgb, a: alpha },
      hsla: { ...current.hsl, a: alpha }
    };

    this.result.set(updated);
  }

  onColorPickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.form.patchValue({ hex: input.value });
      this.convertFromHex();
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
      hue: 214,
      saturation: 100,
      lightness: 50,
      alpha: 1
    });
    this.result.set(null);
    this.errors.set([]);
    this.currentRgb = { r: 0, g: 123, b: 255 };
    this.initCanvases();
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
    this.convertFromHex();
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

  private rgbToHsl(rgb: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
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
      l: Math.round(l * 100)
    };
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = l / 100;

    let r: number, g: number, b: number;

    if (sNorm === 0) {
      r = g = b = lNorm;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      const p = 2 * lNorm - q;

      r = hue2rgb(p, q, hNorm + 1 / 3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  private addToHistory(result: ColorResult): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      hex: result.hex,
      rgb: `rgb(${result.rgb.r}, ${result.rgb.g}, ${result.rgb.b})`
    };
    this.history.update((entries) => {
      const exists = entries.some((e) => e.hex === entry.hex);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  private hexValidator(control: FormControl<string>): { [key: string]: any } | null {
    const value = control.value?.trim() || '';
    if (!value) {
      return null;
    }
    const cleaned = value.replace(/^#/, '');
    if ((cleaned.length === 3 || cleaned.length === 6) && /^[0-9A-Fa-f]+$/.test(cleaned)) {
      return null;
    }
    return { invalidHex: true };
  }
}
