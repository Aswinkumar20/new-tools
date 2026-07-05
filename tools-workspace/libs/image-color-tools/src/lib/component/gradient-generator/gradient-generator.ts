import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

interface ColorStop {
  color: string;
  position: number;
}

interface GradientResult {
  css: string;
  type: 'linear' | 'radial' | 'conic';
  colors: ColorStop[];
  angle?: number;
  position?: string;
  shape?: string;
  size?: string;
}

interface HistoryEntry {
  timestamp: number;
  css: string;
  preview: string;
}

interface GradientPreset {
  label: string;
  description: string;
  type: 'linear' | 'radial' | 'conic';
  colors: ColorStop[];
  angle?: number;
  position?: string;
  shape?: string;
}

type GradientFormGroup = FormGroup<{
  type: FormControl<'linear' | 'radial' | 'conic'>;
  angle: FormControl<number>;
  position: FormControl<string>;
  shape: FormControl<string>;
  size: FormControl<string>;
  colorStops: FormArray<FormGroup<{ color: FormControl<string>; position: FormControl<number> }>>;
  rememberHistory: FormControl<boolean>;
}>;

const PRESETS: GradientPreset[] = [
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
    label: 'Radial sunset',
    description: 'Radial gradient',
    type: 'radial',
    position: 'center',
    shape: 'circle',
    colors: [
      { color: '#FF6B6B', position: 0 },
      { color: '#FFE66D', position: 100 }
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
      { color: '#FF00FF', position: 83.33 },
      { color: '#FF0000', position: 100 }
    ]
  }
];

@Component({
  selector: 'lib-gradient-generator',
  standalone: true,
  templateUrl: './gradient-generator.html',
  styleUrls: ['./gradient-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GradientGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: GradientFormGroup = this.fb.group({
    type: this.fb.control<'linear' | 'radial' | 'conic'>('linear', { nonNullable: true }),
    angle: this.fb.control<number>(90, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(360)]
    }),
    position: this.fb.control<string>('center', { nonNullable: true }),
    shape: this.fb.control<string>('ellipse', { nonNullable: true }),
    size: this.fb.control<string>('farthest-corner', { nonNullable: true }),
    colorStops: this.fb.array<FormGroup<{ color: FormControl<string>; position: FormControl<number> }>>([
      this.createColorStop('#007bff', 0),
      this.createColorStop('#0056b3', 100)
    ]),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
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

  createColorStop(color: string = '#007bff', position: number = 0): FormGroup<{
    color: FormControl<string>;
    position: FormControl<number>;
  }> {
    return this.fb.group({
      color: this.fb.control<string>(color, {
        nonNullable: true,
        validators: [Validators.required, this.hexValidator]
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
    const newPosition = Math.min(100, lastPosition + 10);
    const newStop = this.createColorStop('#007bff', newPosition);
    this.colorStops.push(newStop);
    this.sortColorStops();
  }

  removeColorStop(index: number): void {
    if (this.colorStops.length > 2) {
      this.colorStops.removeAt(index);
      this.generateGradient();
    } else {
      this.errors.set(['A gradient must have at least two color stops.']);
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

    this.generateGradient();
  }

  onPositionChange(index: number): void {
    this.sortColorStops();
    this.generateGradient();
  }

  generateGradient(): void {
    this.errors.set([]);
    const { type, angle, position, shape, size, colorStops } = this.form.getRawValue();

    if (!colorStops || colorStops.length < 2) {
      this.result.set(null);
      return;
    }

    const stops = colorStops
      .map((stop) => ({ color: stop.color, position: stop.position }))
      .sort((a, b) => a.position - b.position);

    let css = '';

    switch (type) {
      case 'linear': {
        css = `linear-gradient(${angle}deg, ${stops.map((s) => `${s.color} ${s.position}%`).join(', ')})`;
        break;
      }
      case 'radial': {
        const shapeSize = size ? `, ${size}` : '';
        css = `radial-gradient(${shape}${shapeSize} at ${position}, ${stops.map((s) => `${s.color} ${s.position}%`).join(', ')})`;
        break;
      }
      case 'conic': {
        css = `conic-gradient(from ${angle}deg at ${position}, ${stops.map((s) => `${s.color} ${s.position}%`).join(', ')})`;
        break;
      }
    }

    const result: GradientResult = {
      css,
      type: type ?? 'linear',
      colors: stops,
      angle: type === 'linear' || type === 'conic' ? angle : undefined,
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
    return current ? current.css : 'linear-gradient(90deg, #007bff 0%, #0056b3 100%)';
  }

  getPresetPreview(preset: GradientPreset): string {
    const stops = preset.colors.map((s) => `${s.color} ${s.position}%`).join(', ');
    switch (preset.type) {
      case 'linear':
        return `linear-gradient(${preset.angle ?? 90}deg, ${stops})`;
      case 'radial':
        const shapeSize = preset.shape ? `${preset.shape} ` : '';
        return `radial-gradient(${shapeSize}at ${preset.position ?? 'center'}, ${stops})`;
      case 'conic':
        return `conic-gradient(from ${preset.angle ?? 0}deg at ${preset.position ?? 'center'}, ${stops})`;
      default:
        return `linear-gradient(90deg, ${stops})`;
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
    this.colorStops.clear();
    this.colorStops.push(this.createColorStop('#007bff', 0));
    this.colorStops.push(this.createColorStop('#0056b3', 100));
    this.form.patchValue({
      type: 'linear',
      angle: 90,
      position: 'center',
      shape: 'ellipse',
      size: 'farthest-corner'
    });
    this.result.set(null);
    this.errors.set([]);
    this.generateGradient();
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  applyHistory(entry: HistoryEntry): void {
    // Parse the CSS and apply it to the form
    // This is a simplified version - in a real app, you'd want a more robust parser
    try {
      const cssMatch = entry.css.match(/^(linear|radial|conic)-gradient\((.+)\)$/);
      if (cssMatch) {
        const [, type, params] = cssMatch;
        this.form.patchValue({ type: type as 'linear' | 'radial' | 'conic' });
        // Parse and apply other parameters...
        this.generateGradient();
      }
    } catch {
      this.errors.set(['Unable to parse history entry.']);
    }
  }

  private sortColorStops(): void {
    const stops = this.colorStops.controls;
    stops.sort((a, b) => {
      const posA = a.controls.position.value;
      const posB = b.controls.position.value;
      return posA - posB;
    });
  }

  private addToHistory(result: GradientResult): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      css: result.css,
      preview: result.css
    };
    this.history.update((entries) => {
      // Avoid duplicates
      const exists = entries.some((e) => e.css === entry.css);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  formatTimestamp(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
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
