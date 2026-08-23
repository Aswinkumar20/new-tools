import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
  HEX_RGB_DEBOUNCE_MS,
  HEX_RGB_DEFAULTS,
  HEX_RGB_ERROR,
  HEX_RGB_RELATED_TOOLS
} from '../../constants/hex-to-rgb.constants';
import { ictCopyText } from '../../shared/ict-clipboard.util';
import type { IctRelatedToolLink } from '../../shared/ict-tool-suggestion.model';
import type {
  HexRgbColorResult,
  HexRgbFormGroup,
  HexRgbHistoryEntry,
  HexRgbInputMode
} from '../../types/hex-to-rgb.types';
import {
  formatHslCss,
  formatHslaCss,
  formatRgbCss,
  formatRgbaCss,
  hexColorValidator
} from '../../utils/ict-color.utils';
import {
  buildHexRgbResultFromHex,
  buildHexRgbResultFromRgb,
  createHexRgbHistoryEntry,
  prependHexRgbHistory,
  resolveHexRgbSuggestion
} from '../../utils/hex-to-rgb.utils';

@Component({
  selector: 'lib-hex-to-rgb',
  standalone: true,
  templateUrl: './hex-to-rgb.html',
  styleUrls: ['./hex-to-rgb.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HexToRgbComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: HexRgbFormGroup = this.fb.group({
    hex: this.fb.control<string>(HEX_RGB_DEFAULTS.hex, {
      nonNullable: true,
      validators: [Validators.required, hexColorValidator]
    }),
    red: this.fb.control<number | null>(HEX_RGB_DEFAULTS.red, {
      validators: [Validators.min(0), Validators.max(255)]
    }),
    green: this.fb.control<number | null>(HEX_RGB_DEFAULTS.green, {
      validators: [Validators.min(0), Validators.max(255)]
    }),
    blue: this.fb.control<number | null>(HEX_RGB_DEFAULTS.blue, {
      validators: [Validators.min(0), Validators.max(255)]
    }),
    alpha: this.fb.control<number>(HEX_RGB_DEFAULTS.alpha, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(1)]
    }),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly relatedTools: ReadonlyArray<IctRelatedToolLink> = HEX_RGB_RELATED_TOOLS;

  readonly result = signal<HexRgbColorResult | null>(null);
  readonly errors = signal<string[]>([]);
  readonly history = signal<HexRgbHistoryEntry[]>([]);
  readonly inputMode = signal<HexRgbInputMode>('hex');
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveHexRgbSuggestion({
      inputMode: this.inputMode(),
      hasResult: this.result() !== null,
      hasError: this.errors().length > 0,
      alpha: this.form.controls.alpha.value ?? 1,
      historyCount: this.history().length
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.controls.hex.valueChanges
      .pipe(
        debounceTime(HEX_RGB_DEBOUNCE_MS),
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
        debounceTime(HEX_RGB_DEBOUNCE_MS),
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
        debounceTime(HEX_RGB_DEBOUNCE_MS),
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
        debounceTime(HEX_RGB_DEBOUNCE_MS),
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
        debounceTime(HEX_RGB_DEBOUNCE_MS),
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

    const built = buildHexRgbResultFromHex(hexValue, alpha);
    if (built.error === 'invalidHex') {
      this.errors.set([HEX_RGB_ERROR.invalidHex]);
      this.result.set(null);
      return;
    }
    if (built.error === 'parseHex' || !built.result) {
      this.errors.set([HEX_RGB_ERROR.parseHex]);
      this.result.set(null);
      return;
    }

    const colorResult = built.result;
    this.result.set(colorResult);
    this.form.patchValue(
      {
        red: colorResult.rgb.r,
        green: colorResult.rgb.g,
        blue: colorResult.rgb.b
      },
      { emitEvent: false }
    );

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(colorResult);
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

    const built = buildHexRgbResultFromRgb(red, green, blue, alpha);
    if (built.error === 'rgbRange' || !built.result) {
      this.errors.set([HEX_RGB_ERROR.rgbRange]);
      this.result.set(null);
      return;
    }

    const colorResult = built.result;
    this.result.set(colorResult);
    this.form.patchValue({ hex: colorResult.hex }, { emitEvent: false });

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(colorResult);
    }
  }

  async copyToClipboard(value: string, label: string): Promise<void> {
    const ok = await ictCopyText(this.toast, value, label);
    if (!ok) {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  formatRgb(result: HexRgbColorResult): string {
    return formatRgbCss(result.rgb);
  }

  formatRgba(result: HexRgbColorResult): string {
    return formatRgbaCss(result.rgb, result.rgba.a);
  }

  formatHsl(result: HexRgbColorResult): string {
    return formatHslCss(result.hsl);
  }

  formatHsla(result: HexRgbColorResult): string {
    return formatHslaCss(result.hsla);
  }

  clear(): void {
    this.form.patchValue({
      hex: HEX_RGB_DEFAULTS.hex,
      red: HEX_RGB_DEFAULTS.red,
      green: HEX_RGB_DEFAULTS.green,
      blue: HEX_RGB_DEFAULTS.blue,
      alpha: HEX_RGB_DEFAULTS.alpha
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

  applyHistory(entry: HexRgbHistoryEntry): void {
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

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private addToHistory(result: HexRgbColorResult): void {
    const entry = createHexRgbHistoryEntry(result);
    this.history.update((entries) => prependHexRgbHistory(entries, entry));
  }
}
