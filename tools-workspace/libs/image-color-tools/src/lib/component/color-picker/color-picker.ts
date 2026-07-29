import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  COLOR_PICKER_DEBOUNCE_MS,
  COLOR_PICKER_DEFAULTS,
  COLOR_PICKER_ERROR,
  COLOR_PICKER_PRESETS,
  COLOR_PICKER_RELATED_TOOLS
} from '../../constants/color-picker.constants';
import { ictCopyText } from '../../shared/ict-clipboard.util';
import type { IctRelatedToolLink } from '../../shared/ict-tool-suggestion.model';
import type {
  ColorPickerFormGroup,
  ColorPickerHistoryEntry,
  ColorPickerResult,
  ColorPreset
} from '../../types/color-picker.types';
import {
  applyAlphaToColorResult,
  buildColorResultFromHex,
  buildColorResultFromHsl,
  buildColorResultFromRgb,
  createHistoryEntry,
  drawHueSpectrumCanvas,
  drawSaturationLightnessCanvas,
  hueFromCanvasY,
  prependUniqueHistory,
  resolveColorPickerSuggestion,
  sampleCanvasPixel
} from '../../utils/color-picker.utils';
import {
  formatHslCss,
  formatHslaCss,
  formatRgbCss,
  formatRgbaCss,
  hexColorValidator,
  isHslInRange,
  isRgbInRange,
  type RgbColor
} from '../../utils/ict-color.utils';

@Component({
  selector: 'lib-color-picker',
  standalone: true,
  templateUrl: './color-picker.html',
  styleUrls: ['./color-picker.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ColorPickerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  @ViewChild('pickerCanvas', { static: false }) pickerCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('hueCanvas', { static: false }) hueCanvas!: ElementRef<HTMLCanvasElement>;

  readonly form: ColorPickerFormGroup = this.fb.group({
    hex: this.fb.control<string>(COLOR_PICKER_DEFAULTS.hex, {
      nonNullable: true,
      validators: [Validators.required, hexColorValidator]
    }),
    red: this.fb.control<number | null>(COLOR_PICKER_DEFAULTS.red, {
      validators: [Validators.min(0), Validators.max(255)]
    }),
    green: this.fb.control<number | null>(COLOR_PICKER_DEFAULTS.green, {
      validators: [Validators.min(0), Validators.max(255)]
    }),
    blue: this.fb.control<number | null>(COLOR_PICKER_DEFAULTS.blue, {
      validators: [Validators.min(0), Validators.max(255)]
    }),
    hue: this.fb.control<number | null>(COLOR_PICKER_DEFAULTS.hue, {
      validators: [Validators.min(0), Validators.max(360)]
    }),
    saturation: this.fb.control<number | null>(COLOR_PICKER_DEFAULTS.saturation, {
      validators: [Validators.min(0), Validators.max(100)]
    }),
    lightness: this.fb.control<number | null>(COLOR_PICKER_DEFAULTS.lightness, {
      validators: [Validators.min(0), Validators.max(100)]
    }),
    alpha: this.fb.control<number>(COLOR_PICKER_DEFAULTS.alpha, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(1)]
    }),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly presets: ReadonlyArray<ColorPreset> = COLOR_PICKER_PRESETS;
  readonly relatedTools: ReadonlyArray<IctRelatedToolLink> = COLOR_PICKER_RELATED_TOOLS;

  readonly result = signal<ColorPickerResult | null>(null);
  readonly errors = signal<string[]>([]);
  readonly history = signal<ColorPickerHistoryEntry[]>([]);
  readonly isPickerActive = signal(false);
  readonly isHueActive = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly isValidColor = computed(() => this.result()?.valid ?? false);
  readonly currentHue = computed(() => this.form.controls.hue.value ?? COLOR_PICKER_DEFAULTS.hue);

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveColorPickerSuggestion({
      hasError: this.errors().length > 0,
      hasResult: this.result() !== null,
      alpha: this.form.controls.alpha.value ?? 1,
      historyCount: this.history().length
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  private currentRgb: RgbColor = {
    r: COLOR_PICKER_DEFAULTS.red,
    g: COLOR_PICKER_DEFAULTS.green,
    b: COLOR_PICKER_DEFAULTS.blue
  };

  constructor() {
    this.form.controls.hex.valueChanges
      .pipe(
        debounceTime(COLOR_PICKER_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.convertFromHex());

    this.form.controls.red.valueChanges
      .pipe(
        debounceTime(COLOR_PICKER_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.convertFromRgb());

    this.form.controls.green.valueChanges
      .pipe(
        debounceTime(COLOR_PICKER_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.convertFromRgb());

    this.form.controls.blue.valueChanges
      .pipe(
        debounceTime(COLOR_PICKER_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.convertFromRgb());

    this.form.controls.hue.valueChanges
      .pipe(
        debounceTime(COLOR_PICKER_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.convertFromHsl());

    this.form.controls.saturation.valueChanges
      .pipe(
        debounceTime(COLOR_PICKER_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.convertFromHsl());

    this.form.controls.lightness.valueChanges
      .pipe(
        debounceTime(COLOR_PICKER_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.convertFromHsl());

    this.form.controls.alpha.valueChanges
      .pipe(
        debounceTime(COLOR_PICKER_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.result()) {
          this.updateAlpha();
        }
      });

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
    try {
      const canvas = this.pickerCanvas?.nativeElement;
      if (!canvas) {
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      drawSaturationLightnessCanvas(ctx, canvas.width, canvas.height, this.currentHue());
    } catch {
      // jsdom / restricted environments may not implement canvas drawing
    }
  }

  drawHueCanvas(): void {
    try {
      const canvas = this.hueCanvas?.nativeElement;
      if (!canvas) {
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      drawHueSpectrumCanvas(ctx, canvas.width, canvas.height);
    } catch {
      // jsdom / restricted environments may not implement canvas drawing
    }
  }

  onPickerClick(event: MouseEvent | KeyboardEvent): void {
    if (event instanceof KeyboardEvent) {
      return;
    }
    const canvas = this.pickerCanvas?.nativeElement;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    this.currentRgb = sampleCanvasPixel(ctx, x, y);
    this.updateFromRgb();
  }

  onPickerDrag(event: MouseEvent): void {
    if (this.isPickerActive()) {
      this.onPickerClick(event);
    }
  }

  onHueClick(event: MouseEvent | KeyboardEvent): void {
    if (event instanceof KeyboardEvent) {
      return;
    }
    const canvas = this.hueCanvas?.nativeElement;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const hue = hueFromCanvasY(y, canvas.height);
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

    const built = buildColorResultFromHex(hexValue, alpha);
    if (built.error === 'invalidHex') {
      this.errors.set([COLOR_PICKER_ERROR.invalidHex]);
      this.result.set(null);
      return;
    }
    if (built.error === 'parseHex' || !built.result) {
      this.errors.set([COLOR_PICKER_ERROR.parseHex]);
      this.result.set(null);
      return;
    }

    const colorResult = built.result;
    this.currentRgb = colorResult.rgb;
    this.result.set(colorResult);
    this.form.patchValue(
      {
        red: colorResult.rgb.r,
        green: colorResult.rgb.g,
        blue: colorResult.rgb.b,
        hue: colorResult.hsl.h,
        saturation: colorResult.hsl.s,
        lightness: colorResult.hsl.l
      },
      { emitEvent: false }
    );
    this.drawPickerCanvas();
    this.maybeAddToHistory(colorResult);
  }

  convertFromRgb(): void {
    this.errors.set([]);
    const red = this.form.controls.red.value;
    const green = this.form.controls.green.value;
    const blue = this.form.controls.blue.value;

    if (red === null || green === null || blue === null) {
      this.result.set(null);
      return;
    }

    if (!isRgbInRange(red, green, blue)) {
      this.errors.set([COLOR_PICKER_ERROR.rgbRange]);
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

    if (!isHslInRange(hue, saturation, lightness)) {
      this.errors.set([COLOR_PICKER_ERROR.hslRange]);
      this.result.set(null);
      return;
    }

    const colorResult = buildColorResultFromHsl(hue, saturation, lightness, alpha);
    this.currentRgb = colorResult.rgb;
    this.result.set(colorResult);
    this.form.patchValue(
      {
        hex: colorResult.hex,
        red: colorResult.rgb.r,
        green: colorResult.rgb.g,
        blue: colorResult.rgb.b
      },
      { emitEvent: false }
    );
    this.drawPickerCanvas();
    this.maybeAddToHistory(colorResult);
  }

  updateFromRgb(): void {
    const alpha = this.form.controls.alpha.value ?? 1;
    const colorResult = buildColorResultFromRgb(this.currentRgb, alpha);
    this.result.set(colorResult);
    this.form.patchValue(
      {
        hex: colorResult.hex,
        hue: colorResult.hsl.h,
        saturation: colorResult.hsl.s,
        lightness: colorResult.hsl.l
      },
      { emitEvent: false }
    );
    this.drawPickerCanvas();
    this.maybeAddToHistory(colorResult);
  }

  updateAlpha(): void {
    const current = this.result();
    if (!current) {
      return;
    }
    const alpha = this.form.controls.alpha.value ?? 1;
    this.result.set(applyAlphaToColorResult(current, alpha));
  }

  onColorPickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.form.patchValue({ hex: input.value });
      this.convertFromHex();
    }
  }

  async copyToClipboard(value: string, label: string): Promise<void> {
    const ok = await ictCopyText(this.toast, value, label);
    if (!ok) {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  formatRgb(rgb: RgbColor): string {
    return formatRgbCss(rgb);
  }

  formatRgba(result: ColorPickerResult): string {
    return formatRgbaCss(result.rgb, result.rgba.a);
  }

  formatHsl(result: ColorPickerResult): string {
    return formatHslCss(result.hsl);
  }

  formatHsla(result: ColorPickerResult): string {
    return formatHslaCss(result.hsla);
  }

  clear(): void {
    this.form.patchValue({
      hex: COLOR_PICKER_DEFAULTS.hex,
      red: COLOR_PICKER_DEFAULTS.red,
      green: COLOR_PICKER_DEFAULTS.green,
      blue: COLOR_PICKER_DEFAULTS.blue,
      hue: COLOR_PICKER_DEFAULTS.hue,
      saturation: COLOR_PICKER_DEFAULTS.saturation,
      lightness: COLOR_PICKER_DEFAULTS.lightness,
      alpha: COLOR_PICKER_DEFAULTS.alpha
    });
    this.result.set(null);
    this.errors.set([]);
    this.currentRgb = {
      r: COLOR_PICKER_DEFAULTS.red,
      g: COLOR_PICKER_DEFAULTS.green,
      b: COLOR_PICKER_DEFAULTS.blue
    };
    this.initCanvases();
    this.convertFromHex();
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  applyHistory(entry: ColorPickerHistoryEntry): void {
    this.form.patchValue({ hex: entry.hex });
    this.convertFromHex();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private maybeAddToHistory(colorResult: ColorPickerResult): void {
    if (!this.form.controls.rememberHistory.value) {
      return;
    }
    const entry = createHistoryEntry(colorResult);
    this.history.update((entries) => prependUniqueHistory(entries, entry));
  }
}
