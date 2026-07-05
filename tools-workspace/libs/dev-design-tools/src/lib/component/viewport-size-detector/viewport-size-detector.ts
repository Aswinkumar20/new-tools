import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface ViewportInfo {
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  orientation: 'portrait' | 'landscape';
  aspectRatio: number;
  timestamp: number;
}

interface HistoryEntry {
  timestamp: number;
  width: number;
  height: number;
  aspectRatio: number;
}

interface Breakpoint {
  name: string;
  min: number;
  max: number;
}

type ViewportDetectorFormGroup = FormGroup<{
  rememberHistory: FormControl<boolean>;
}>;

const BREAKPOINTS: Breakpoint[] = [
  { name: 'Mobile', min: 0, max: 767 },
  { name: 'Tablet', min: 768, max: 1023 },
  { name: 'Desktop', min: 1024, max: 1439 },
  { name: 'Large Desktop', min: 1440, max: Infinity }
];

@Component({
  selector: 'lib-viewport-size-detector',
  standalone: true,
  templateUrl: './viewport-size-detector.html',
  styleUrls: ['./viewport-size-detector.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewportSizeDetectorComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);
  private resizeListener?: () => void;

  readonly form: ViewportDetectorFormGroup = this.fb.group({
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly breakpoints = BREAKPOINTS;
  readonly viewportInfo = signal<ViewportInfo | null>(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly Math = Math;

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly activeBreakpoint = computed(() => {
    const info = this.viewportInfo();
    if (!info) {
      return null;
    }
    return this.breakpoints.find((bp) => info.viewportWidth >= bp.min && info.viewportWidth <= bp.max) || this.breakpoints[0];
  });
  readonly Infinity = Infinity;

  ngOnInit(): void {
    this.updateViewportInfo();
    this.setupResizeListener();
  }

  ngOnDestroy(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  private setupResizeListener(): void {
    this.resizeListener = () => {
      this.updateViewportInfo();
    };
    window.addEventListener('resize', this.resizeListener, { passive: true });
  }

  private updateViewportInfo(): void {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const orientation = viewportWidth > viewportHeight ? 'landscape' : 'portrait';
    const aspectRatio = viewportWidth / viewportHeight;

    const info: ViewportInfo = {
      viewportWidth,
      viewportHeight,
      screenWidth,
      screenHeight,
      devicePixelRatio,
      orientation,
      aspectRatio,
      timestamp: Date.now()
    };

    this.viewportInfo.set(info);

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(viewportWidth, viewportHeight, aspectRatio);
    }
  }

  copyMetrics(): void {
    const info = this.viewportInfo();
    if (!info) return;
    const lines = [
      `Viewport: ${info.viewportWidth} × ${info.viewportHeight} px`,
      `Screen: ${info.screenWidth} × ${info.screenHeight} px`,
      `Aspect ratio: ${info.aspectRatio.toFixed(2)}:1`,
      `Device pixel ratio: ${info.devicePixelRatio}x`,
      `Orientation: ${info.orientation}`,
      `Breakpoint: ${this.formatBreakpointName(this.activeBreakpoint())}`,
    ];
    this.copyText(lines.join('\n'), 'Viewport metrics');
  }

  copyJson(): void {
    const info = this.viewportInfo();
    if (!info) return;
    this.copyText(JSON.stringify(info, null, 2), 'Viewport metrics JSON');
  }

  copyToClipboard(text: string, label: string): void {
    this.copyText(text, label);
  }

  private copyText(text: string, label: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  private addToHistory(width: number, height: number, aspectRatio: number): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      width,
      height,
      aspectRatio
    };

    this.history.update((entries) => {
      // Check if this exact size already exists (within 1px tolerance)
      const exists = entries.some((e) => Math.abs(e.width - width) < 1 && Math.abs(e.height - height) < 1);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 20);
    });
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

  getBreakpointColor(bp: Breakpoint | null): string {
    if (!bp) {
      return '#94a3b8';
    }
    const index = this.breakpoints.indexOf(bp);
    const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545'];
    return colors[index % colors.length];
  }

  formatBreakpointName(bp: Breakpoint | null): string {
    if (!bp) {
      return 'Unknown';
    }
    if (bp.max === Infinity) {
      return `${bp.name} (${bp.min}+px)`;
    }
    return `${bp.name} (${bp.min}-${bp.max}px)`;
  }
}
