import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  CSS_GRADIENT_ANGLE_MAX,
  CSS_GRADIENT_ANGLE_MIN,
  CSS_GRADIENT_DEFAULT_ANGLE,
  CSS_GRADIENT_DEFAULT_POSITION,
  CSS_GRADIENT_DEFAULT_SHAPE,
  CSS_GRADIENT_DEFAULT_SIZE,
  CSS_GRADIENT_DEFAULT_STOPS,
  CSS_GRADIENT_PRESETS,
  CSS_GRADIENT_RELATED_TOOLS
} from '../../constants/css-gradient-generator.constants';
import type {
  GradientHistoryEntry,
  GradientPreset,
  GradientResult,
  GradientType
} from '../../types/css-gradient-generator.types';
import {
  buildGradientResult,
  buildPresetPreview,
  capitalizeGradientType,
  formatRelativeTimestamp,
  interpolateColor,
  prependGradientHistory,
  resolveCssGradientSuggestion,
  resolveGradientStyle
} from '../../utils/css-gradient-generator.utils';

type ColorStopFormGroup = FormGroup<{
  color: FormControl<string>;
  position: FormControl<number>;
}>;

type GradientFormGroup = FormGroup<{
  type: FormControl<GradientType>;
  angle: FormControl<number>;
  position: FormControl<string>;
  shape: FormControl<string>;
  size: FormControl<string>;
  colorStops: FormArray<ColorStopFormGroup>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-css-gradient-generator',
  standalone: true,
  templateUrl: './css-gradient-generator.html',
  styleUrls: ['./css-gradient-generator.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CssGradientGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: GradientFormGroup = this.fb.group({
    type: this.fb.control<GradientType>('linear', { nonNullable: true }),
    angle: this.fb.control(CSS_GRADIENT_DEFAULT_ANGLE, {
      nonNullable: true,
      validators: [Validators.min(CSS_GRADIENT_ANGLE_MIN), Validators.max(CSS_GRADIENT_ANGLE_MAX)]
    }),
    position: this.fb.control(CSS_GRADIENT_DEFAULT_POSITION, { nonNullable: true }),
    shape: this.fb.control(CSS_GRADIENT_DEFAULT_SHAPE, { nonNullable: true }),
    size: this.fb.control(CSS_GRADIENT_DEFAULT_SIZE, { nonNullable: true }),
    colorStops: this.fb.array<ColorStopFormGroup>(
      CSS_GRADIENT_DEFAULT_STOPS.map((stop) => this.createColorStop(stop.color, stop.position))
    ),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly presets = CSS_GRADIENT_PRESETS;
  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = CSS_GRADIENT_RELATED_TOOLS;
  readonly result = signal<GradientResult | null>(null);
  readonly errors = signal<string[]>([]);
  readonly history = signal<GradientHistoryEntry[]>([]);
  private readonly hasCopiedCss = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly gradientCss = computed(() => this.result()?.css ?? '');
  readonly colorStopsFormArray = computed(() => this.form.controls.colorStops);
  readonly primarySuggestion = computed(() => {
    const suggestion = resolveCssGradientSuggestion({
      result: this.result(),
      hasCopiedCss: this.hasCopiedCss(),
      stopCount: this.form.controls.colorStops.length
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.dismissedSuggestionId.set(null);
        this.generateGradient();
      });

    this.generateGradient();
  }

  get colorStops(): FormArray<ColorStopFormGroup> {
    return this.form.controls.colorStops;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  addColorStop(): void {
    const stops = this.colorStops.value;
    const lastStop = stops[stops.length - 1];
    const newPosition = Math.min(100, (lastStop?.position ?? 0) + 20);
    const newColor = interpolateColor(
      stops[stops.length - 2]?.color ?? '#007bff',
      lastStop?.color ?? '#0056b3',
      0.5
    );
    this.colorStops.push(this.createColorStop(newColor, newPosition));
    this.generateGradient();
  }

  removeColorStop(index: number): void {
    if (this.colorStops.length > 2) {
      this.colorStops.removeAt(index);
      this.generateGradient();
    }
  }

  applyPreset(preset: GradientPreset): void {
    this.hasCopiedCss.set(false);
    this.dismissedSuggestionId.set(null);
    this.form.patchValue({
      type: preset.type,
      angle: preset.angle ?? CSS_GRADIENT_DEFAULT_ANGLE,
      position: preset.position ?? CSS_GRADIENT_DEFAULT_POSITION,
      shape: preset.shape ?? CSS_GRADIENT_DEFAULT_SHAPE,
      size: preset.size ?? CSS_GRADIENT_DEFAULT_SIZE
    });

    while (this.colorStops.length > 0) {
      this.colorStops.removeAt(0);
    }
    for (const stop of preset.colors) {
      this.colorStops.push(this.createColorStop(stop.color, stop.position));
    }

    this.generateGradient();
  }

  onPositionChange(_index: number): void {
    this.generateGradient();
  }

  generateGradient(): void {
    this.errors.set([]);
    const { type, angle, position, shape, size, colorStops } = this.form.getRawValue();
    const built = buildGradientResult({ type, angle, position, shape, size, colorStops });

    if ('error' in built) {
      this.errors.set([built.error]);
      if (built.error === 'Add at least two color stops.') {
        this.result.set(null);
      }
      return;
    }

    this.result.set(built);

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(built);
    }
  }

  getGradientStyle(): string {
    return resolveGradientStyle(this.result());
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
    while (this.colorStops.length > 0) {
      this.colorStops.removeAt(0);
    }
    for (const stop of CSS_GRADIENT_DEFAULT_STOPS) {
      this.colorStops.push(this.createColorStop(stop.color, stop.position));
    }
    this.form.patchValue({
      type: 'linear',
      angle: CSS_GRADIENT_DEFAULT_ANGLE,
      position: CSS_GRADIENT_DEFAULT_POSITION,
      shape: CSS_GRADIENT_DEFAULT_SHAPE,
      size: CSS_GRADIENT_DEFAULT_SIZE
    });
    this.generateGradient();
  }

  applyHistory(entry: GradientHistoryEntry): void {
    while (this.colorStops.length > 0) {
      this.colorStops.removeAt(0);
    }
    for (const stop of entry.colors) {
      this.colorStops.push(this.createColorStop(stop.color, stop.position));
    }
    this.form.patchValue({
      type: entry.type,
      angle: entry.angle,
      position: entry.position,
      shape: entry.shape,
      size: entry.size
    });
    this.generateGradient();
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  getPresetPreview(preset: GradientPreset): string {
    return buildPresetPreview(preset);
  }

  formatTypeLabel(type: GradientType | string | null | undefined): string {
    return capitalizeGradientType(type);
  }

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  private createColorStop(color: string, position: number): ColorStopFormGroup {
    return this.fb.group({
      color: this.fb.control(color, { nonNullable: true }),
      position: this.fb.control(position, {
        nonNullable: true,
        validators: [Validators.min(0), Validators.max(100)]
      })
    });
  }

  private addToHistory(result: GradientResult): void {
    const { angle, position, shape, size } = this.form.getRawValue();
    const entry: GradientHistoryEntry = {
      timestamp: Date.now(),
      css: result.css,
      type: result.type,
      angle: angle ?? 0,
      position: position ?? CSS_GRADIENT_DEFAULT_POSITION,
      shape: shape ?? CSS_GRADIENT_DEFAULT_SHAPE,
      size: size ?? CSS_GRADIENT_DEFAULT_SIZE,
      colors: result.colors.map((c) => ({ ...c }))
    };

    this.history.update((entries) => prependGradientHistory(entries, entry));
  }
}
