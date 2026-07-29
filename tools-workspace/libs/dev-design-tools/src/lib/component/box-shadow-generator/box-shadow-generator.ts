import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  BOX_SHADOW_BLUR_MAX,
  BOX_SHADOW_BLUR_MIN,
  BOX_SHADOW_DEFAULTS,
  BOX_SHADOW_OFFSET_MAX,
  BOX_SHADOW_OFFSET_MIN,
  BOX_SHADOW_PRESETS,
  BOX_SHADOW_RELATED_TOOLS,
  BOX_SHADOW_SPREAD_MAX,
  BOX_SHADOW_SPREAD_MIN
} from '../../constants/box-shadow-generator.constants';
import type {
  BoxShadowHistoryEntry,
  BoxShadowPreset,
  BoxShadowValues
} from '../../types/box-shadow-generator.types';
import {
  boxShadowRgbToHex,
  buildBoxShadowCss,
  buildBoxShadowHistoryPreview,
  buildBoxShadowPresetPreview,
  buildBoxShadowStyle,
  formatRelativeTimestamp,
  hexWithOpacityToRgba,
  parseBoxShadowColorOpacity,
  prependBoxShadowHistory,
  resolveBoxShadowSuggestion,
  validateBoxShadowColor
} from '../../utils/box-shadow-generator.utils';

type BoxShadowFormGroup = FormGroup<{
  offsetX: FormControl<number>;
  offsetY: FormControl<number>;
  blur: FormControl<number>;
  spread: FormControl<number>;
  color: FormControl<string>;
  inset: FormControl<boolean>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-box-shadow-generator',
  standalone: true,
  templateUrl: './box-shadow-generator.html',
  styleUrls: ['./box-shadow-generator.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoxShadowGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: BoxShadowFormGroup = this.fb.group({
    offsetX: this.fb.control(BOX_SHADOW_DEFAULTS.offsetX, {
      nonNullable: true,
      validators: [Validators.min(BOX_SHADOW_OFFSET_MIN), Validators.max(BOX_SHADOW_OFFSET_MAX)]
    }),
    offsetY: this.fb.control(BOX_SHADOW_DEFAULTS.offsetY, {
      nonNullable: true,
      validators: [Validators.min(BOX_SHADOW_OFFSET_MIN), Validators.max(BOX_SHADOW_OFFSET_MAX)]
    }),
    blur: this.fb.control(BOX_SHADOW_DEFAULTS.blur, {
      nonNullable: true,
      validators: [Validators.min(BOX_SHADOW_BLUR_MIN), Validators.max(BOX_SHADOW_BLUR_MAX)]
    }),
    spread: this.fb.control(BOX_SHADOW_DEFAULTS.spread, {
      nonNullable: true,
      validators: [Validators.min(BOX_SHADOW_SPREAD_MIN), Validators.max(BOX_SHADOW_SPREAD_MAX)]
    }),
    color: this.fb.control(BOX_SHADOW_DEFAULTS.color, { nonNullable: true }),
    inset: this.fb.control(BOX_SHADOW_DEFAULTS.inset, { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly presets = BOX_SHADOW_PRESETS;
  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = BOX_SHADOW_RELATED_TOOLS;
  readonly errors = signal<string[]>([]);
  readonly history = signal<BoxShadowHistoryEntry[]>([]);
  private readonly formTick = signal(0);
  private readonly hasCopiedCss = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly boxShadowCss = computed(() => {
    this.formTick();
    return buildBoxShadowCss(this.shadowValues());
  });
  readonly boxShadowStyle = computed(() => {
    this.formTick();
    return buildBoxShadowStyle(this.shadowValues());
  });
  readonly colorOpacity = computed(() => {
    this.formTick();
    return parseBoxShadowColorOpacity(this.form.controls.color.value);
  });
  readonly primarySuggestion = computed(() => {
    this.formTick();
    const suggestion = resolveBoxShadowSuggestion({
      values: this.shadowValues(),
      hasCopiedCss: this.hasCopiedCss(),
      colorOpacity: parseBoxShadowColorOpacity(this.form.controls.color.value)
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
        this.validateColor();
        this.updateHistory();
      });

    this.formTick.update((n) => n + 1);
    this.updateHistory();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  applyPreset(preset: BoxShadowPreset): void {
    this.form.patchValue({
      offsetX: preset.offsetX,
      offsetY: preset.offsetY,
      blur: preset.blur,
      spread: preset.spread,
      color: preset.color,
      inset: preset.inset
    });
    this.refreshDerivedState();
  }

  async copyToClipboard(text: string, label: string): Promise<void> {
    const ok = await ddCopyText(this.toast, text, label);
    if (ok) {
      this.hasCopiedCss.set(true);
      this.errors.set([]);
    } else {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  clear(): void {
    this.hasCopiedCss.set(false);
    this.dismissedSuggestionId.set(null);
    this.form.patchValue({ ...BOX_SHADOW_DEFAULTS });
    this.refreshDerivedState();
  }

  applyHistory(entry: BoxShadowHistoryEntry): void {
    this.form.patchValue({
      offsetX: entry.values.offsetX,
      offsetY: entry.values.offsetY,
      blur: entry.values.blur,
      spread: entry.values.spread,
      color: entry.values.color,
      inset: entry.values.inset
    });
    this.refreshDerivedState();
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  getPresetPreview(preset: BoxShadowPreset): string {
    return buildBoxShadowPresetPreview(preset);
  }

  getHistoryPreview(entry: BoxShadowHistoryEntry): string {
    return buildBoxShadowHistoryPreview(entry);
  }

  getColorValue(): string {
    return boxShadowRgbToHex(this.form.controls.color.value) ?? '#000000';
  }

  onColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rgba = hexWithOpacityToRgba(input.value, this.parseCurrentOpacity());
    if (rgba) {
      this.form.patchValue({ color: rgba });
      this.refreshDerivedState();
    }
  }

  onOpacityChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const alpha = Math.min(1, Math.max(0, Number.parseFloat(input.value) || 0));
    const rgba = hexWithOpacityToRgba(this.getColorValue(), alpha);
    if (rgba) {
      this.form.patchValue({ color: rgba });
      this.refreshDerivedState();
    }
  }

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  private shadowValues(): BoxShadowValues {
    const { offsetX, offsetY, blur, spread, color, inset } = this.form.getRawValue();
    return { offsetX, offsetY, blur, spread, color, inset };
  }

  private parseCurrentOpacity(): number {
    return parseBoxShadowColorOpacity(this.form.controls.color.value);
  }

  private refreshDerivedState(): void {
    this.formTick.update((n) => n + 1);
    this.validateColor();
    this.updateHistory();
  }

  private validateColor(): void {
    const message = validateBoxShadowColor(this.form.controls.color.value ?? '');
    this.errors.set(message ? [message] : []);
  }

  private updateHistory(): void {
    if (!this.form.controls.rememberHistory.value) {
      return;
    }

    const values = this.shadowValues();
    const entry: BoxShadowHistoryEntry = {
      timestamp: Date.now(),
      css: buildBoxShadowCss(values),
      values
    };

    this.history.update((entries) => prependBoxShadowHistory(entries, entry));
  }
}
