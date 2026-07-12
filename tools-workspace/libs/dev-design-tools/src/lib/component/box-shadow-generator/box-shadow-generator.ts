import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface BoxShadowPreset {
  label: string;
  description: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

interface HistoryEntry {
  timestamp: number;
  css: string;
  values: {
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    color: string;
    inset: boolean;
  };
}

type BoxShadowFormGroup = FormGroup<{
  offsetX: FormControl<number>;
  offsetY: FormControl<number>;
  blur: FormControl<number>;
  spread: FormControl<number>;
  color: FormControl<string>;
  inset: FormControl<boolean>;
  rememberHistory: FormControl<boolean>;
}>;

const PRESETS: BoxShadowPreset[] = [
  {
    label: 'None',
    description: 'No shadow',
    offsetX: 0,
    offsetY: 0,
    blur: 0,
    spread: 0,
    color: '#000000',
    inset: false
  },
  {
    label: 'Small',
    description: 'Subtle shadow',
    offsetX: 0,
    offsetY: 1,
    blur: 3,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.12)',
    inset: false
  },
  {
    label: 'Medium',
    description: 'Standard shadow',
    offsetX: 0,
    offsetY: 2,
    blur: 8,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: false
  },
  {
    label: 'Large',
    description: 'Prominent shadow',
    offsetX: 0,
    offsetY: 4,
    blur: 16,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.18)',
    inset: false
  },
  {
    label: 'Extra Large',
    description: 'Dramatic shadow',
    offsetX: 0,
    offsetY: 8,
    blur: 24,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.2)',
    inset: false
  },
  {
    label: 'Blue shadow',
    description: 'Blue themed shadow',
    offsetX: 0,
    offsetY: 4,
    blur: 12,
    spread: 0,
    color: 'rgba(0, 123, 255, 0.3)',
    inset: false
  },
  {
    label: 'Inset',
    description: 'Inset shadow',
    offsetX: 0,
    offsetY: 2,
    blur: 4,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: true
  },
  {
    label: 'Soft elevation',
    description: 'Soft elevated card shadow',
    offsetX: 0,
    offsetY: 10,
    blur: 30,
    spread: -5,
    color: 'rgba(0, 0, 0, 0.12)',
    inset: false
  },
  {
    label: 'Top shadow',
    description: 'Shadow above',
    offsetX: 0,
    offsetY: -4,
    blur: 8,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: false
  },
  {
    label: 'Right shadow',
    description: 'Shadow to the right',
    offsetX: 4,
    offsetY: 0,
    blur: 8,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: false
  }
];

@Component({
  selector: 'lib-box-shadow-generator',
  standalone: true,
  templateUrl: './box-shadow-generator.html',
  styleUrls: ['./box-shadow-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoxShadowGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: BoxShadowFormGroup = this.fb.group({
    offsetX: this.fb.control(0, {
      nonNullable: true,
      validators: [Validators.min(-100), Validators.max(100)]
    }),
    offsetY: this.fb.control(4, {
      nonNullable: true,
      validators: [Validators.min(-100), Validators.max(100)]
    }),
    blur: this.fb.control(12, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(200)]
    }),
    spread: this.fb.control(0, {
      nonNullable: true,
      validators: [Validators.min(-50), Validators.max(50)]
    }),
    color: this.fb.control('rgba(0, 0, 0, 0.15)', { nonNullable: true }),
    inset: this.fb.control(false, { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly presets = PRESETS;
  readonly errors = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);
  /** Bumped on form changes so computed CSS/preview stay in sync with reactive forms. */
  private readonly formTick = signal(0);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly boxShadowCss = computed(() => {
    this.formTick();
    return this.getBoxShadowCss();
  });
  readonly boxShadowStyle = computed(() => {
    this.formTick();
    return this.getBoxShadowStyle();
  });
  readonly colorOpacity = computed(() => {
    this.formTick();
    return this.parseColorOpacity(this.form.controls.color.value);
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(50), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formTick.update((n) => n + 1);
        this.validateColor();
        this.updateHistory();
      });

    this.formTick.update((n) => n + 1);
    this.updateHistory();
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
  }

  getBoxShadowCss(): string {
    const { offsetX, offsetY, blur, spread, color, inset } = this.form.getRawValue();
    const safeColor = this.normalizeColor(color) ?? 'rgba(0, 0, 0, 0.15)';
    const insetStr = inset ? 'inset ' : '';
    return `box-shadow: ${insetStr}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${safeColor};`;
  }

  getBoxShadowStyle(): string {
    const { offsetX, offsetY, blur, spread, color, inset } = this.form.getRawValue();
    const safeColor = this.normalizeColor(color) ?? 'rgba(0, 0, 0, 0.15)';
    const insetStr = inset ? 'inset ' : '';
    return `${insetStr}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${safeColor}`;
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
      offsetX: 0,
      offsetY: 4,
      blur: 12,
      spread: 0,
      color: 'rgba(0, 0, 0, 0.15)',
      inset: false
    });
  }

  applyHistory(entry: HistoryEntry): void {
    this.form.patchValue({
      offsetX: entry.values.offsetX,
      offsetY: entry.values.offsetY,
      blur: entry.values.blur,
      spread: entry.values.spread,
      color: entry.values.color,
      inset: entry.values.inset
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

    const { offsetX, offsetY, blur, spread, color, inset } = this.form.getRawValue();
    const css = this.getBoxShadowCss();

    const entry: HistoryEntry = {
      timestamp: Date.now(),
      css,
      values: { offsetX, offsetY, blur, spread, color, inset }
    };

    this.history.update((entries) => {
      const exists = entries.some((e) => e.css === entry.css);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  getPresetPreview(preset: BoxShadowPreset): string {
    const insetStr = preset.inset ? 'inset ' : '';
    return `${insetStr}${preset.offsetX}px ${preset.offsetY}px ${preset.blur}px ${preset.spread}px ${preset.color}`;
  }

  getHistoryPreview(entry: HistoryEntry): string {
    const { offsetX, offsetY, blur, spread, color, inset } = entry.values;
    const insetStr = inset ? 'inset ' : '';
    return `${insetStr}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`;
  }

  getColorValue(): string {
    return this.rgbToHex(this.form.controls.color.value) ?? '#000000';
  }

  onColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const hex = input.value;
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) {
      return;
    }
    const alpha = this.parseColorOpacity(this.form.controls.color.value);
    this.form.patchValue({ color: `rgba(${r}, ${g}, ${b}, ${alpha})` });
  }

  onOpacityChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const alpha = Math.min(1, Math.max(0, Number.parseFloat(input.value) || 0));
    const hex = this.getColorValue();
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    this.form.patchValue({ color: `rgba(${r}, ${g}, ${b}, ${alpha})` });
  }

  private validateColor(): void {
    const color = this.form.controls.color.value?.trim() ?? '';
    if (!color || this.normalizeColor(color)) {
      this.errors.set([]);
      return;
    }
    this.errors.set(['Enter a valid color (hex like #000000 or rgb/rgba).']);
  }

  private normalizeColor(color: string): string | null {
    const value = color.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
      return value;
    }
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(value)) {
      return value;
    }
    return null;
  }

  private parseColorOpacity(color: string): number {
    const match = color.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)/i);
    if (match) {
      return Number.parseFloat(match[1]);
    }
    return 1;
  }

  private rgbToHex(color: string): string | null {
    const value = color.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
      if (value.length === 4) {
        return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      }
      return value;
    }
    const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) {
      return null;
    }
    const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
    return `#${toHex(Number(match[1]))}${toHex(Number(match[2]))}${toHex(Number(match[3]))}`;
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
