import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface Breakpoint {
  name: string;
  width: number;
  height: number;
  icon: string;
}

interface ActiveBreakpoint {
  name: string;
  min: number;
  max: number;
}

type ResponsiveTesterFormGroup = FormGroup<{
  url: FormControl<string>;
  width: FormControl<number>;
  height: FormControl<number>;
  showGrid: FormControl<boolean>;
  showRulers: FormControl<boolean>;
}>;

const PRESET_BREAKPOINTS: Breakpoint[] = [
  { name: 'Mobile (Small)', width: 375, height: 667, icon: '📱' },
  { name: 'Mobile (Large)', width: 414, height: 896, icon: '📱' },
  { name: 'Tablet (Portrait)', width: 768, height: 1024, icon: '📱' },
  { name: 'Tablet (Landscape)', width: 1024, height: 768, icon: '📱' },
  { name: 'Desktop (Small)', width: 1280, height: 720, icon: '💻' },
  { name: 'Desktop (Medium)', width: 1440, height: 900, icon: '💻' },
  { name: 'Desktop (Large)', width: 1920, height: 1080, icon: '💻' },
  { name: 'Desktop (4K)', width: 3840, height: 2160, icon: '🖥️' }
];

const COMMON_BREAKPOINTS: ActiveBreakpoint[] = [
  { name: 'Mobile', min: 0, max: 767 },
  { name: 'Tablet', min: 768, max: 1023 },
  { name: 'Desktop', min: 1024, max: 1439 },
  { name: 'Large Desktop', min: 1440, max: Infinity }
];

@Component({
  selector: 'lib-responsive-breakpoint-tester',
  standalone: true,
  templateUrl: './responsive-breakpoint-tester.html',
  styleUrls: ['./responsive-breakpoint-tester.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResponsiveBreakpointTesterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  @ViewChild('iframe', { static: false }) iframeRef?: ElementRef<HTMLIFrameElement>;

  readonly form: ResponsiveTesterFormGroup = this.fb.group({
    url: this.fb.control('https://example.com', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^https?:\/\/.+/)]
    }),
    width: this.fb.control(1280, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(320), Validators.max(5000)]
    }),
    height: this.fb.control(720, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(240), Validators.max(5000)]
    }),
    showGrid: this.fb.control(false, { nonNullable: true }),
    showRulers: this.fb.control(false, { nonNullable: true })
  });

  readonly presetBreakpoints = PRESET_BREAKPOINTS;
  readonly commonBreakpoints = COMMON_BREAKPOINTS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly currentWidth = signal<number>(1280);
  readonly currentHeight = signal<number>(720);
  readonly Infinity = Infinity;

  readonly activeBreakpoint = computed(() => {
    const width = this.currentWidth();
    return this.commonBreakpoints.find((bp) => width >= bp.min && width <= bp.max) || this.commonBreakpoints[0];
  });

  readonly iframeUrl = computed(() => {
    const url = this.form.controls.url.value;
    if (!url || !this.form.controls.url.valid) {
      return null;
    }
    return url;
  });

  constructor() {
    // Update current dimensions when form changes
    this.form.valueChanges
      .pipe(debounceTime(100), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const { width, height } = this.form.getRawValue();
        this.currentWidth.set(width);
        this.currentHeight.set(height);
      });

    // Initial update
    this.currentWidth.set(this.form.controls.width.value);
    this.currentHeight.set(this.form.controls.height.value);
  }

  applyPreset(preset: Breakpoint): void {
    this.form.patchValue({
      width: preset.width,
      height: preset.height
    });
  }

  loadUrl(): void {
    this.errors.set([]);
    const url = this.form.controls.url.value;

    if (!url || !this.form.controls.url.valid) {
      this.errors.set(['Please enter a valid URL starting with http:// or https://']);
      return;
    }

    // Iframe will load automatically when url changes
    if (this.iframeRef?.nativeElement) {
      this.iframeRef.nativeElement.src = url;
    }
  }

  rotate(): void {
    const { width, height } = this.form.getRawValue();
    this.form.patchValue({
      width: height,
      height: width
    });
  }

  reset(): void {
    this.form.patchValue({
      url: 'https://example.com',
      width: 1280,
      height: 720,
      showGrid: false,
      showRulers: false
    });
    this.errors.set([]);
    this.warnings.set([]);
  }

  copyDimensions(): void {
    const { width, height } = this.form.getRawValue();
    const text = `${width}x${height}`;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Success
      })
      .catch(() => {
        this.errors.set(['Unable to copy dimensions to clipboard.']);
      });
  }

  formatBreakpointName(bp: ActiveBreakpoint | undefined): string {
    if (!bp) {
      return 'Unknown';
    }
    if (bp.max === Infinity) {
      return `${bp.name} (${bp.min}+px)`;
    }
    return `${bp.name} (${bp.min}-${bp.max}px)`;
  }

  getBreakpointColor(bp: ActiveBreakpoint | undefined): string {
    if (!bp) {
      return '#94a3b8';
    }
    const index = this.commonBreakpoints.indexOf(bp);
    const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545'];
    return colors[index % colors.length];
  }

  getGridRows(): number[] {
    const height = this.currentHeight();
    const step = 50;
    const rows: number[] = [];
    for (let i = step; i < height; i += step) {
      rows.push(i);
    }
    return rows;
  }

  getGridCols(): number[] {
    const width = this.currentWidth();
    const step = 50;
    const cols: number[] = [];
    for (let i = step; i < width; i += step) {
      cols.push(i);
    }
    return cols;
  }
}
