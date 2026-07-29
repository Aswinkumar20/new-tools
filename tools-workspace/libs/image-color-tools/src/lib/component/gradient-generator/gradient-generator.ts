import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  GRADIENT_DEBOUNCE_MS,
  GRADIENT_DEFAULTS,
  GRADIENT_ERROR,
  GRADIENT_MIN_STOPS,
  GRADIENT_PRESETS,
  GRADIENT_RELATED_TOOLS
} from '../../constants/gradient-generator.constants';
import { ictCopyText } from '../../shared/ict-clipboard.util';
import type { IctRelatedToolLink } from '../../shared/ict-tool-suggestion.model';
import type {
  ColorStopFormGroup,
  GradientFormGroup,
  GradientFormValues,
  GradientHistoryEntry,
  GradientPreset,
  GradientResult,
  GradientType
} from '../../types/gradient-generator.types';
import { hexColorValidator } from '../../utils/ict-color.utils';
import {
  buildGradientResult,
  buildPresetPreviewCss,
  createGradientHistoryEntry,
  formatRelativeTimestamp,
  nextColorStopPosition,
  parseGradientTypeFromCss,
  prependUniqueGradientHistory,
  resolveGradientPreviewCss,
  resolveGradientSuggestion,
  titleCaseGradientType
} from '../../utils/gradient-generator.utils';

@Component({
  selector: 'lib-gradient-generator',
  standalone: true,
  templateUrl: './gradient-generator.html',
  styleUrls: ['./gradient-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GradientGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: GradientFormGroup = this.fb.group({
    type: this.fb.control<GradientType>(GRADIENT_DEFAULTS.type, { nonNullable: true }),
    angle: this.fb.control<number>(GRADIENT_DEFAULTS.angle, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(360)]
    }),
    position: this.fb.control<string>(GRADIENT_DEFAULTS.position, { nonNullable: true }),
    shape: this.fb.control<string>(GRADIENT_DEFAULTS.shape, { nonNullable: true }),
    size: this.fb.control<string>(GRADIENT_DEFAULTS.size, { nonNullable: true }),
    colorStops: this.fb.array<ColorStopFormGroup>(
      GRADIENT_DEFAULTS.stops.map((stop) => this.createColorStop(stop.color, stop.position))
    ),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly presets: ReadonlyArray<GradientPreset> = GRADIENT_PRESETS;
  readonly relatedTools: ReadonlyArray<IctRelatedToolLink> = GRADIENT_RELATED_TOOLS;

  readonly formSnapshot = signal<GradientFormValues>(this.form.getRawValue());
  readonly result = signal<GradientResult | null>(null);
  readonly errors = signal<string[]>([]);
  readonly history = signal<GradientHistoryEntry[]>([]);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly gradientCss = computed(() => this.result()?.css ?? '');
  readonly colorStopsFormArray = computed(() => this.form.controls.colorStops);
  readonly currentType = computed(() => this.formSnapshot().type);

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveGradientSuggestion({
      type: this.formSnapshot().type,
      stopCount: this.form.controls.colorStops.length,
      hasResult: this.hasResult(),
      hasError: this.errors().length > 0,
      historyCount: this.history().length
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges
      .pipe(
        debounceTime(GRADIENT_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.formSnapshot.set(this.form.getRawValue());
        this.generateGradient();
      });

    this.generateGradient();
  }

  get colorStops(): FormArray<ColorStopFormGroup> {
    return this.form.controls.colorStops;
  }

  createColorStop(color = '#007bff', position = 0): ColorStopFormGroup {
    return this.fb.group({
      color: this.fb.control<string>(color, {
        nonNullable: true,
        validators: [Validators.required, hexColorValidator]
      }),
      position: this.fb.control<number>(position, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), Validators.max(100)]
      })
    });
  }

  addColorStop(): void {
    const stops = this.colorStops;
    const lastStop = stops.at(stops.length - 1);
    const lastPosition = lastStop?.controls.position.value ?? 0;
    this.colorStops.push(this.createColorStop('#007bff', nextColorStopPosition(lastPosition)));
    this.sortColorStops();
  }

  removeColorStop(index: number): void {
    if (this.colorStops.length > GRADIENT_MIN_STOPS) {
      this.colorStops.removeAt(index);
      this.generateGradient();
    } else {
      this.errors.set([GRADIENT_ERROR.minStops]);
    }
  }

  applyPreset(preset: GradientPreset): void {
    this.form.patchValue({
      type: preset.type,
      angle: preset.angle ?? 90,
      position: preset.position ?? 'center',
      shape: preset.shape ?? 'ellipse'
    });

    this.colorStops.clear();
    preset.colors.forEach((stop) => {
      this.colorStops.push(this.createColorStop(stop.color, stop.position));
    });

    this.formSnapshot.set(this.form.getRawValue());
    this.generateGradient();
  }

  onPositionChange(_index: number): void {
    this.sortColorStops();
    this.generateGradient();
  }

  generateGradient(): void {
    this.errors.set([]);
    const { type, angle, position, shape, size, colorStops } = this.form.getRawValue();
    this.formSnapshot.set(this.form.getRawValue());

    if (!colorStops || colorStops.length < GRADIENT_MIN_STOPS) {
      this.result.set(null);
      return;
    }

    const gradientResult = buildGradientResult({
      type,
      angle,
      position,
      shape,
      size,
      stops: colorStops
    });

    this.result.set(gradientResult);

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(gradientResult);
    }
  }

  getGradientStyle(): string {
    return resolveGradientPreviewCss(this.result());
  }

  getPresetPreview(preset: GradientPreset): string {
    return buildPresetPreviewCss(preset);
  }

  typeLabel(type: string | undefined): string {
    return titleCaseGradientType(type ?? '');
  }

  async copyToClipboard(value: string, label: string): Promise<void> {
    const ok = await ictCopyText(this.toast, value, label);
    if (!ok) {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  clear(): void {
    this.colorStops.clear();
    GRADIENT_DEFAULTS.stops.forEach((stop) => {
      this.colorStops.push(this.createColorStop(stop.color, stop.position));
    });
    this.form.patchValue({
      type: GRADIENT_DEFAULTS.type,
      angle: GRADIENT_DEFAULTS.angle,
      position: GRADIENT_DEFAULTS.position,
      shape: GRADIENT_DEFAULTS.shape,
      size: GRADIENT_DEFAULTS.size
    });
    this.result.set(null);
    this.errors.set([]);
    this.formSnapshot.set(this.form.getRawValue());
    this.generateGradient();
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  applyHistory(entry: GradientHistoryEntry): void {
    try {
      const type = parseGradientTypeFromCss(entry.css);
      if (type) {
        this.form.patchValue({ type });
        this.formSnapshot.set(this.form.getRawValue());
        this.generateGradient();
      }
    } catch {
      this.errors.set([GRADIENT_ERROR.parseHistory]);
    }
  }

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private sortColorStops(): void {
    const stops = this.colorStops.controls;
    stops.sort((a, b) => a.controls.position.value - b.controls.position.value);
  }

  private addToHistory(result: GradientResult): void {
    const entry = createGradientHistoryEntry(result);
    this.history.update((entries) => prependUniqueGradientHistory(entries, entry));
  }
}
