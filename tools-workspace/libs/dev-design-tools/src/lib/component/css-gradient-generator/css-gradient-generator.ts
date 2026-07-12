import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type GradientType = 'linear' | 'radial' | 'conic';

interface ColorStop {
  color: string;
  position: number;
}

interface GradientResult {
  css: string;
  type: GradientType;
  colors: ColorStop[];
  angle?: number;
  position?: string;
  shape?: string;
  size?: string;
}

interface GradientPreset {
  label: string;
  description: string;
  type: GradientType;
  angle?: number;
  position?: string;
  shape?: string;
  size?: string;
  colors: ColorStop[];
}

interface HistoryEntry {
  timestamp: number;
  css: string;
  type: GradientType;
  angle: number;
  position: string;
  shape: string;
  size: string;
  colors: ColorStop[];
}

type GradientFormGroup = FormGroup<{
  type: FormControl<GradientType>;
  angle: FormControl<number>;
  position: FormControl<string>;
  shape: FormControl<string>;
  size: FormControl<string>;
  colorStops: FormArray<FormGroup<{ color: FormControl<string>; position: FormControl<number> }>>;
  rememberHistory: FormControl<boolean>;
}>;

const PRESETS: GradientPreset[] = [
  {
    label: 'Blue gradient',
    description: 'Linear gradient',
    type: 'linear',
    angle: 135,
    colors: [
      { color: '#007bff', position: 0 },
      { color: '#0056b3', position: 100 }
    ]
  },
  {
    label: 'Sunset',
    description: 'Linear gradient',
    type: 'linear',
    angle: 45,
    colors: [
      { color: '#FF6B6B', position: 0 },
      { color: '#FFE66D', position: 100 }
    ]
  },
  {
    label: 'Ocean',
    description: 'Linear gradient',
    type: 'linear',
    angle: 180,
    colors: [
      { color: '#667EEA', position: 0 },
      { color: '#764BA2', position: 100 }
    ]
  },
  {
    label: 'Radial blue',
    description: 'Radial gradient',
    type: 'radial',
    position: 'center',
    shape: 'circle',
    colors: [
      { color: '#007bff', position: 0 },
      { color: '#0056b3', position: 100 }
    ]
  },
  {
    label: 'Conic rainbow',
    description: 'Conic gradient',
    type: 'conic',
    angle: 0,
    position: 'center',
    colors: [
      { color: '#FF0000', position: 0 },
      { color: '#FFFF00', position: 16.66 },
      { color: '#00FF00', position: 33.33 },
      { color: '#00FFFF', position: 50 },
      { color: '#0000FF', position: 66.66 },
      { color: '#FF0000', position: 100 }
    ]
  }
];

@Component({
  selector: 'lib-css-gradient-generator',
  standalone: true,
  templateUrl: './css-gradient-generator.html',
  styleUrls: ['./css-gradient-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CssGradientGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: GradientFormGroup = this.fb.group({
    type: this.fb.control<GradientType>('linear', { nonNullable: true }),
    angle: this.fb.control(135, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(360)]
    }),
    position: this.fb.control('center', { nonNullable: true }),
    shape: this.fb.control('ellipse', { nonNullable: true }),
    size: this.fb.control('farthest-corner', { nonNullable: true }),
    colorStops: this.fb.array<FormGroup<{ color: FormControl<string>; position: FormControl<number> }>>([
      this.createColorStop('#007bff', 0),
      this.createColorStop('#0056b3', 100)
    ]),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly presets = PRESETS;
  readonly result: WritableSignal<GradientResult | null> = signal(null);
  readonly errors = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly gradientCss = computed(() => this.result()?.css ?? '');
  readonly colorStopsFormArray = computed(() => this.form.controls.colorStops);

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.generateGradient();
      });

    // Initial generation
    this.generateGradient();
  }

  get colorStops(): FormArray<FormGroup<{ color: FormControl<string>; position: FormControl<number> }>> {
    return this.form.controls.colorStops;
  }

  private createColorStop(color: string, position: number): FormGroup<{ color: FormControl<string>; position: FormControl<number> }> {
    return this.fb.group({
      color: this.fb.control(color, { nonNullable: true }),
      position: this.fb.control(position, {
        nonNullable: true,
        validators: [Validators.min(0), Validators.max(100)]
      })
    });
  }

  addColorStop(): void {
    const stops = this.colorStops.value;
    const lastStop = stops[stops.length - 1];
    const newPosition = Math.min(100, (lastStop?.position ?? 0) + 20);
    const newColor = this.interpolateColor(
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
    this.form.patchValue({
      type: preset.type,
      angle: preset.angle ?? 135,
      position: preset.position ?? 'center',
      shape: preset.shape ?? 'ellipse',
      size: preset.size ?? 'farthest-corner'
    });

    // Clear and add new color stops
    while (this.colorStops.length > 0) {
      this.colorStops.removeAt(0);
    }
    const newStops = preset.colors.map((stop) => this.createColorStop(stop.color, stop.position));
    for (const stop of newStops) {
      this.colorStops.push(stop);
    }

    this.generateGradient();
  }

  onPositionChange(index: number): void {
    this.generateGradient();
  }

  generateGradient(): void {
    this.errors.set([]);
    const { type, angle, position, shape, size, colorStops } = this.form.getRawValue();

    if (!colorStops || colorStops.length < 2) {
      this.errors.set(['Add at least two color stops.']);
      this.result.set(null);
      return;
    }

    const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
    const invalidStop = colorStops.find((stop) => !hexPattern.test(stop.color?.trim() ?? ''));
    if (invalidStop) {
      this.errors.set(['Each color stop needs a valid hex color (#RGB or #RRGGBB).']);
      return;
    }

    const safeAngle = Math.min(360, Math.max(0, Number(angle) || 0));
    const stops = colorStops
      .map((stop) => ({
        color: stop.color.trim(),
        position: Math.min(100, Math.max(0, Number(stop.position) || 0))
      }))
      .sort((a, b) => a.position - b.position);

    let css = '';
    const stopsString = stops.map((s) => `${s.color} ${s.position}%`).join(', ');

    switch (type) {
      case 'linear': {
        css = `linear-gradient(${safeAngle}deg, ${stopsString})`;
        break;
      }
      case 'radial': {
        const shapeSize = size ? ` ${size}` : '';
        css = `radial-gradient(${shape}${shapeSize} at ${position || 'center'}, ${stopsString})`;
        break;
      }
      case 'conic': {
        css = `conic-gradient(from ${safeAngle}deg at ${position || 'center'}, ${stopsString})`;
        break;
      }
    }

    const result: GradientResult = {
      css,
      type: type ?? 'linear',
      colors: stops,
      angle: type === 'linear' || type === 'conic' ? safeAngle : undefined,
      position: type === 'radial' || type === 'conic' ? position : undefined,
      shape: type === 'radial' ? shape : undefined,
      size: type === 'radial' ? size : undefined
    };

    this.result.set(result);

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(result);
    }
  }

  getGradientStyle(): string {
    const current = this.result();
    return current ? current.css : 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)';
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
    // Reset to default
    while (this.colorStops.length > 0) {
      this.colorStops.removeAt(0);
    }
    const defaultStops = [
      this.createColorStop('#007bff', 0),
      this.createColorStop('#0056b3', 100)
    ];
    for (const stop of defaultStops) {
      this.colorStops.push(stop);
    }
    this.form.patchValue({
      type: 'linear',
      angle: 135,
      position: 'center',
      shape: 'ellipse',
      size: 'farthest-corner'
    });
    this.generateGradient();
  }

  applyHistory(entry: HistoryEntry): void {
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

  private addToHistory(result: GradientResult): void {
    const { angle, position, shape, size } = this.form.getRawValue();
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      css: result.css,
      type: result.type,
      angle: angle ?? 0,
      position: position ?? 'center',
      shape: shape ?? 'ellipse',
      size: size ?? 'farthest-corner',
      colors: result.colors.map((c) => ({ ...c }))
    };

    this.history.update((entries) => {
      const exists = entries.some((e) => e.css === entry.css);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  private interpolateColor(color1: string, color2: string, factor: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    if (!c1 || !c2) return '#007bff';

    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));

    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16)
        }
      : null;
  }

  getPresetPreview(preset: GradientPreset): string {
    const stops = preset.colors.map((s) => `${s.color} ${s.position}%`).join(', ');
    switch (preset.type) {
      case 'linear':
        return `linear-gradient(${preset.angle ?? 90}deg, ${stops})`;
      case 'radial':
        return `radial-gradient(${preset.shape ?? 'ellipse'} at ${preset.position ?? 'center'}, ${stops})`;
      case 'conic':
        return `conic-gradient(from ${preset.angle ?? 0}deg at ${preset.position ?? 'center'}, ${stops})`;
      default:
        return `linear-gradient(90deg, ${stops})`;
    }
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
