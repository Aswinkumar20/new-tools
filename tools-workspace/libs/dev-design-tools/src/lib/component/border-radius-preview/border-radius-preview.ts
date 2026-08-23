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
import { Navigation, TooltipDirective, AssetService, ToastService, StatValueTooltipHostDirective } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  BORDER_RADIUS_DEFAULT,
  BORDER_RADIUS_MAX,
  BORDER_RADIUS_MIN,
  BORDER_RADIUS_PRESETS,
  BORDER_RADIUS_RELATED_TOOLS
} from '../../constants/border-radius-preview.constants';
import type {
  BorderRadiusHistoryEntry,
  BorderRadiusMode,
  BorderRadiusPreset,
  BorderRadiusUnit
} from '../../types/border-radius-preview.types';
import {
  buildBorderRadiusCss,
  buildBorderRadiusStyle,
  buildHistoryPreview,
  buildPresetPreview,
  formatRelativeTimestamp,
  prependBorderRadiusHistory,
  resolveBorderRadiusSuggestion,
  resolvePresetUnit
} from '../../utils/border-radius-preview.utils';

type BorderRadiusFormGroup = FormGroup<{
  mode: FormControl<BorderRadiusMode>;
  uniform: FormControl<number>;
  topLeft: FormControl<number>;
  topRight: FormControl<number>;
  bottomRight: FormControl<number>;
  bottomLeft: FormControl<number>;
  unit: FormControl<BorderRadiusUnit>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-border-radius-preview',
  standalone: true,
  templateUrl: './border-radius-preview.html',
  styleUrls: ['./border-radius-preview.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BorderRadiusPreviewComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: BorderRadiusFormGroup = this.fb.group({
    mode: this.fb.control<BorderRadiusMode>('uniform', { nonNullable: true }),
    uniform: this.fb.control(BORDER_RADIUS_DEFAULT, {
      nonNullable: true,
      validators: [Validators.min(BORDER_RADIUS_MIN), Validators.max(BORDER_RADIUS_MAX)]
    }),
    topLeft: this.fb.control(BORDER_RADIUS_DEFAULT, {
      nonNullable: true,
      validators: [Validators.min(BORDER_RADIUS_MIN), Validators.max(BORDER_RADIUS_MAX)]
    }),
    topRight: this.fb.control(BORDER_RADIUS_DEFAULT, {
      nonNullable: true,
      validators: [Validators.min(BORDER_RADIUS_MIN), Validators.max(BORDER_RADIUS_MAX)]
    }),
    bottomRight: this.fb.control(BORDER_RADIUS_DEFAULT, {
      nonNullable: true,
      validators: [Validators.min(BORDER_RADIUS_MIN), Validators.max(BORDER_RADIUS_MAX)]
    }),
    bottomLeft: this.fb.control(BORDER_RADIUS_DEFAULT, {
      nonNullable: true,
      validators: [Validators.min(BORDER_RADIUS_MIN), Validators.max(BORDER_RADIUS_MAX)]
    }),
    unit: this.fb.control<BorderRadiusUnit>('px', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly presets = BORDER_RADIUS_PRESETS;
  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = BORDER_RADIUS_RELATED_TOOLS;
  readonly errors = signal<string[]>([]);
  readonly history = signal<BorderRadiusHistoryEntry[]>([]);
  private readonly formTick = signal(0);
  private readonly hasCopiedCss = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly borderRadiusCss = computed(() => {
    this.formTick();
    return buildBorderRadiusCss(this.form.getRawValue());
  });
  readonly borderRadiusStyle = computed(() => {
    this.formTick();
    return buildBorderRadiusStyle(this.form.getRawValue());
  });
  readonly primarySuggestion = computed(() => {
    this.formTick();
    const suggestion = resolveBorderRadiusSuggestion({
      values: this.form.getRawValue(),
      hasCopiedCss: this.hasCopiedCss()
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
        this.updateHistory();
      });

    this.formTick.update((n) => n + 1);
    this.updateHistory();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  onUniformChange(): void {
    const uniformValue = this.form.controls.uniform.value;
    this.form.patchValue({
      topLeft: uniformValue,
      topRight: uniformValue,
      bottomRight: uniformValue,
      bottomLeft: uniformValue
    });
    this.refreshDerivedState();
  }

  onModeChange(): void {
    if (this.form.controls.mode.value === 'uniform') {
      const uniformValue = this.form.controls.uniform.value;
      this.form.patchValue({
        topLeft: uniformValue,
        topRight: uniformValue,
        bottomRight: uniformValue,
        bottomLeft: uniformValue
      });
      this.refreshDerivedState();
    }
  }

  loadExample(): void {
    const card = this.presets.find((preset) => preset.label === 'Product card');
    if (card) {
      this.applyPreset(card);
    }
  }

  applyPreset(preset: BorderRadiusPreset): void {
    this.form.patchValue({
      mode: 'individual',
      topLeft: preset.topLeft,
      topRight: preset.topRight,
      bottomRight: preset.bottomRight,
      bottomLeft: preset.bottomLeft,
      uniform: preset.topLeft,
      unit: resolvePresetUnit(preset, this.form.controls.unit.value)
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
    this.form.patchValue({
      mode: 'uniform',
      uniform: BORDER_RADIUS_DEFAULT,
      topLeft: BORDER_RADIUS_DEFAULT,
      topRight: BORDER_RADIUS_DEFAULT,
      bottomRight: BORDER_RADIUS_DEFAULT,
      bottomLeft: BORDER_RADIUS_DEFAULT,
      unit: 'px'
    });
    this.refreshDerivedState();
  }

  applyHistory(entry: BorderRadiusHistoryEntry): void {
    this.form.patchValue({
      mode: entry.values.mode ?? 'individual',
      topLeft: entry.values.topLeft,
      topRight: entry.values.topRight,
      bottomRight: entry.values.bottomRight,
      bottomLeft: entry.values.bottomLeft,
      uniform: entry.values.topLeft,
      unit: entry.values.unit ?? 'px'
    });
    this.refreshDerivedState();
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  getPresetPreview(preset: BorderRadiusPreset): string {
    return buildPresetPreview(preset);
  }

  getHistoryPreview(entry: BorderRadiusHistoryEntry): string {
    return buildHistoryPreview(entry);
  }

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  private refreshDerivedState(): void {
    this.formTick.update((n) => n + 1);
    this.updateHistory();
  }

  private updateHistory(): void {
    if (!this.form.controls.rememberHistory.value) {
      return;
    }

    const values = this.form.getRawValue();
    const css = buildBorderRadiusCss(values);
    const entry: BorderRadiusHistoryEntry = {
      timestamp: Date.now(),
      css,
      values: {
        topLeft: values.topLeft,
        topRight: values.topRight,
        bottomRight: values.bottomRight,
        bottomLeft: values.bottomLeft,
        unit: values.unit,
        mode: values.mode
      }
    };

    this.history.update((entries) => prependBorderRadiusHistory(entries, entry));
  }
}
