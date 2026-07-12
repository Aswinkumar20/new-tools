import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface BorderRadiusPreset {
  label: string;
  description: string;
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

interface HistoryEntry {
  timestamp: number;
  css: string;
  values: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
    unit: 'px' | 'rem' | 'em' | '%';
    mode: 'uniform' | 'individual';
  };
}

type BorderRadiusFormGroup = FormGroup<{
  mode: FormControl<'uniform' | 'individual'>;
  uniform: FormControl<number>;
  topLeft: FormControl<number>;
  topRight: FormControl<number>;
  bottomRight: FormControl<number>;
  bottomLeft: FormControl<number>;
  unit: FormControl<'px' | 'rem' | 'em' | '%'>;
  rememberHistory: FormControl<boolean>;
}>;

const PRESETS: BorderRadiusPreset[] = [
  {
    label: 'None',
    description: '0px all corners',
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0
  },
  {
    label: 'Small',
    description: '4px all corners',
    topLeft: 4,
    topRight: 4,
    bottomRight: 4,
    bottomLeft: 4
  },
  {
    label: 'Medium',
    description: '8px all corners',
    topLeft: 8,
    topRight: 8,
    bottomRight: 8,
    bottomLeft: 8
  },
  {
    label: 'Large',
    description: '16px all corners',
    topLeft: 16,
    topRight: 16,
    bottomRight: 16,
    bottomLeft: 16
  },
  {
    label: 'Extra Large',
    description: '24px all corners',
    topLeft: 24,
    topRight: 24,
    bottomRight: 24,
    bottomLeft: 24
  },
  {
    label: 'Pill',
    description: '9999px all corners (pill shape)',
    topLeft: 9999,
    topRight: 9999,
    bottomRight: 9999,
    bottomLeft: 9999
  },
  {
    label: 'Circle',
    description: '50% all corners',
    topLeft: 50,
    topRight: 50,
    bottomRight: 50,
    bottomLeft: 50
  },
  {
    label: 'Top rounded',
    description: 'Top corners only',
    topLeft: 16,
    topRight: 16,
    bottomRight: 0,
    bottomLeft: 0
  },
  {
    label: 'Bottom rounded',
    description: 'Bottom corners only',
    topLeft: 0,
    topRight: 0,
    bottomRight: 16,
    bottomLeft: 16
  },
  {
    label: 'Left rounded',
    description: 'Left corners only',
    topLeft: 16,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 16
  },
  {
    label: 'Right rounded',
    description: 'Right corners only',
    topLeft: 0,
    topRight: 16,
    bottomRight: 16,
    bottomLeft: 0
  }
];

@Component({
  selector: 'lib-border-radius-preview',
  standalone: true,
  templateUrl: './border-radius-preview.html',
  styleUrls: ['./border-radius-preview.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BorderRadiusPreviewComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: BorderRadiusFormGroup = this.fb.group({
    mode: this.fb.control<'uniform' | 'individual'>('uniform', { nonNullable: true }),
    uniform: this.fb.control(8, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(500)]
    }),
    topLeft: this.fb.control(8, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(500)]
    }),
    topRight: this.fb.control(8, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(500)]
    }),
    bottomRight: this.fb.control(8, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(500)]
    }),
    bottomLeft: this.fb.control(8, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(500)]
    }),
    unit: this.fb.control<'px' | 'rem' | 'em' | '%'>('px', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly presets = PRESETS;
  readonly errors = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);
  private readonly formTick = signal(0);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly borderRadiusCss = computed(() => {
    this.formTick();
    return this.getBorderRadiusCss();
  });
  readonly borderRadiusStyle = computed(() => {
    this.formTick();
    return this.getBorderRadiusStyle();
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(50), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formTick.update((n) => n + 1);
        this.updateHistory();
      });

    this.formTick.update((n) => n + 1);
    this.updateHistory();
  }

  onUniformChange(): void {
    const uniformValue = this.form.controls.uniform.value;
    this.form.patchValue({
      topLeft: uniformValue,
      topRight: uniformValue,
      bottomRight: uniformValue,
      bottomLeft: uniformValue
    });
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
    }
  }

  applyPreset(preset: BorderRadiusPreset): void {
    const isPercentage = preset.label === 'Circle';
    const isPill = preset.label === 'Pill';

    this.form.patchValue({
      mode: 'individual',
      topLeft: preset.topLeft,
      topRight: preset.topRight,
      bottomRight: preset.bottomRight,
      bottomLeft: preset.bottomLeft,
      uniform: preset.topLeft,
      unit: isPercentage ? '%' : isPill ? 'px' : this.form.controls.unit.value
    });
  }

  getBorderRadiusCss(): string {
    const { mode, uniform, topLeft, topRight, bottomRight, bottomLeft, unit } = this.form.getRawValue();

    if (mode === 'uniform') {
      return `border-radius: ${uniform}${unit};`;
    }

    // Always emit 4-value shorthand so TL/TR/BR/BL map correctly
    // (CSS 2-value form is TL+BR / TR+BL, not top/bottom pairs).
    if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
      return `border-radius: ${topLeft}${unit};`;
    }

    if (topLeft === bottomRight && topRight === bottomLeft) {
      return `border-radius: ${topLeft}${unit} ${topRight}${unit};`;
    }

    return `border-radius: ${topLeft}${unit} ${topRight}${unit} ${bottomRight}${unit} ${bottomLeft}${unit};`;
  }

  getBorderRadiusStyle(): string {
    const { mode, uniform, topLeft, topRight, bottomRight, bottomLeft, unit } = this.form.getRawValue();

    if (mode === 'uniform') {
      return `${uniform}${unit}`;
    }

    return `${topLeft}${unit} ${topRight}${unit} ${bottomRight}${unit} ${bottomLeft}${unit}`;
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
      mode: 'uniform',
      uniform: 8,
      topLeft: 8,
      topRight: 8,
      bottomRight: 8,
      bottomLeft: 8,
      unit: 'px'
    });
  }

  applyHistory(entry: HistoryEntry): void {
    this.form.patchValue({
      mode: entry.values.mode ?? 'individual',
      topLeft: entry.values.topLeft,
      topRight: entry.values.topRight,
      bottomRight: entry.values.bottomRight,
      bottomLeft: entry.values.bottomLeft,
      uniform: entry.values.topLeft,
      unit: entry.values.unit ?? 'px'
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

    const { mode, topLeft, topRight, bottomRight, bottomLeft, unit } = this.form.getRawValue();
    const css = this.getBorderRadiusCss();

    const entry: HistoryEntry = {
      timestamp: Date.now(),
      css,
      values: { topLeft, topRight, bottomRight, bottomLeft, unit, mode }
    };

    this.history.update((entries) => {
      const exists = entries.some((e) => e.css === entry.css);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  getPresetPreview(preset: BorderRadiusPreset): string {
    const unit = preset.label === 'Circle' ? '%' : 'px';
    return `${preset.topLeft}${unit} ${preset.topRight}${unit} ${preset.bottomRight}${unit} ${preset.bottomLeft}${unit}`;
  }

  getHistoryPreview(entry: HistoryEntry): string {
    const { topLeft, topRight, bottomRight, bottomLeft, unit } = entry.values;
    const u = unit ?? 'px';
    return `${topLeft}${u} ${topRight}${u} ${bottomRight}${u} ${bottomLeft}${u}`;
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
