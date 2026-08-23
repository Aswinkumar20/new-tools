import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService, StatValueTooltipHostDirective } from '@tools-workspace/features-home';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  VIEWPORT_BREAKPOINTS,
  VIEWPORT_RELATED_TOOLS
} from '../../constants/viewport-size-detector.constants';
import type {
  ViewportBreakpoint,
  ViewportHistoryEntry,
  ViewportInfo
} from '../../types/viewport-size-detector.types';
import {
  effectiveResolution,
  findActiveBreakpoint,
  formatBreakpointName,
  formatOrientationLabel,
  formatRelativeTimestamp,
  formatViewportMetricsJson,
  formatViewportMetricsText,
  getBreakpointColor,
  isOpenEndedBreakpoint,
  prependViewportHistory,
  readViewportInfo,
  resolveViewportSuggestion
} from '../../utils/viewport-size-detector.utils';

type ViewportDetectorFormGroup = FormGroup<{
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-viewport-size-detector',
  standalone: true,
  templateUrl: './viewport-size-detector.html',
  styleUrls: ['./viewport-size-detector.scss'],
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewportSizeDetectorComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  private resizeListener?: () => void;
  private visualViewportListener?: () => void;

  readonly form: ViewportDetectorFormGroup = this.fb.group({
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly breakpoints = VIEWPORT_BREAKPOINTS;
  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = VIEWPORT_RELATED_TOOLS;
  readonly viewportInfo = signal<ViewportInfo | null>(null);
  readonly history = signal<ViewportHistoryEntry[]>([]);
  readonly errors = signal<string[]>([]);
  private readonly hasCopiedMetrics = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly activeBreakpoint = computed(() => {
    const info = this.viewportInfo();
    if (!info) {
      return null;
    }
    return findActiveBreakpoint(info.viewportWidth);
  });
  readonly effectivePixelSize = computed(() => {
    const info = this.viewportInfo();
    return info ? effectiveResolution(info) : null;
  });
  readonly primarySuggestion = computed(() => {
    const suggestion = resolveViewportSuggestion({
      info: this.viewportInfo(),
      hasCopiedMetrics: this.hasCopiedMetrics()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  ngOnInit(): void {
    this.refreshViewportInfo();
    this.setupResizeListener();
  }

  ngOnDestroy(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    if (this.visualViewportListener && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.visualViewportListener);
      window.visualViewport.removeEventListener('scroll', this.visualViewportListener);
    }
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  async copyMetrics(): Promise<void> {
    const info = this.viewportInfo();
    if (!info) {
      return;
    }
    await this.copyText(formatViewportMetricsText(info, this.activeBreakpoint()), 'Viewport metrics');
  }

  async copyJson(): Promise<void> {
    const info = this.viewportInfo();
    if (!info) {
      return;
    }
    await this.copyText(formatViewportMetricsJson(info), 'Viewport metrics JSON');
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  formatTimestamp(timestamp: number): string {
    return formatRelativeTimestamp(timestamp);
  }

  breakpointColor(bp: ViewportBreakpoint | null): string {
    return getBreakpointColor(bp);
  }

  formatBreakpointLabel(bp: ViewportBreakpoint | null): string {
    return formatBreakpointName(bp);
  }

  orientationLabel(orientation: ViewportInfo['orientation']): string {
    return formatOrientationLabel(orientation);
  }

  isOpenEnded(bp: ViewportBreakpoint): boolean {
    return isOpenEndedBreakpoint(bp);
  }

  private setupResizeListener(): void {
    this.resizeListener = () => {
      this.hasCopiedMetrics.set(false);
      this.dismissedSuggestionId.set(null);
      this.refreshViewportInfo();
    };
    window.addEventListener('resize', this.resizeListener, { passive: true });

    if (window.visualViewport) {
      this.visualViewportListener = () => {
        this.hasCopiedMetrics.set(false);
        this.dismissedSuggestionId.set(null);
        this.refreshViewportInfo();
      };
      window.visualViewport.addEventListener('resize', this.visualViewportListener, { passive: true });
      window.visualViewport.addEventListener('scroll', this.visualViewportListener, { passive: true });
    }
  }

  private refreshViewportInfo(): void {
    const info = readViewportInfo(window);
    this.viewportInfo.set(info);

    if (this.form.controls.rememberHistory.value) {
      this.addToHistory(info.viewportWidth, info.viewportHeight, info.aspectRatio);
    }
  }

  private addToHistory(width: number, height: number, aspectRatio: number): void {
    const entry: ViewportHistoryEntry = {
      timestamp: Date.now(),
      width,
      height,
      aspectRatio
    };
    this.history.update((entries) => prependViewportHistory(entries, entry));
  }

  private async copyText(text: string, label: string): Promise<void> {
    const ok = await ddCopyText(this.toast, text, label);
    if (ok) {
      this.hasCopiedMetrics.set(true);
      this.dismissedSuggestionId.set(null);
      this.errors.set([]);
    } else {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }
}
