import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { buCopyText } from '../../shared/bu-clipboard.util';
import { buDownloadJson, buDownloadTimestamp } from '../../shared/bu-download.util';
import {
  ORIENTATION_RELATED_TOOLS,
  ORIENTATION_SAMPLE_LIMIT
} from '../../constants/device-orientation.constants';
import type { BuRelatedToolLink, BuToolSuggestion } from '../../shared/bu-tool-suggestion.model';
import type {
  DeviceOrientationEventConstructor,
  OrientationSample
} from '../../types/device-orientation.types';
import {
  createOrientationSample,
  formatAllOrientationSamples,
  formatOrientationAngle,
  formatOrientationSample,
  formatOrientationTimestamp,
  getOrientationPermissionRequest,
  isDeviceOrientationSupported,
  prependOrientationSample,
  resolveOrientationSuggestion
} from '../../utils/device-orientation.utils';

@Component({
  selector: 'lib-device-orientation-logger',
  standalone: true,
  templateUrl: './device-orientation-logger.html',
  styleUrls: ['./device-orientation-logger.scss'],
  imports: [RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeviceOrientationLoggerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly sampleLimit = ORIENTATION_SAMPLE_LIMIT;
  readonly relatedTools: ReadonlyArray<BuRelatedToolLink> = ORIENTATION_RELATED_TOOLS;

  readonly formatAngle = formatOrientationAngle;
  readonly formatTimestamp = formatOrientationTimestamp;

  readonly isSupported = signal(isDeviceOrientationSupported(this.isBrowser));
  readonly samples = signal<OrientationSample[]>([]);
  readonly isListening = signal(false);
  readonly errors = signal<string[]>([]);
  readonly dismissedSuggestionId = signal<string | null>(null);

  readonly latestSample = computed(() => (this.samples().length ? this.samples()[0] : null));
  readonly hasSamples = computed(() => this.samples().length > 0);

  readonly primarySuggestion = computed<BuToolSuggestion | null>(() => {
    const suggestion = resolveOrientationSuggestion(
      this.isSupported(),
      this.isListening(),
      this.samples().length
    );
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  private readonly onOrientationEvent = (event: DeviceOrientationEvent) => {
    const sample = createOrientationSample({
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      absolute: event.absolute
    });
    this.samples.update((current) => prependOrientationSample(current, sample));
  };

  async startLogging(): Promise<void> {
    this.errors.set([]);
    if (!this.isSupported()) {
      this.errors.set(['Device orientation is not supported in this browser.']);
      return;
    }

    try {
      const permissionRequest = getOrientationPermissionRequest(
        (window as Window & { DeviceOrientationEvent?: DeviceOrientationEventConstructor })
          .DeviceOrientationEvent
      );
      if (permissionRequest) {
        const permission = await permissionRequest();
        if (permission !== 'granted') {
          this.errors.set(['Permission to access device orientation was denied.']);
          return;
        }
      }
    } catch {
      // Some platforms do not require (or support) an explicit permission prompt.
    }

    window.addEventListener('deviceorientation', this.onOrientationEvent, { passive: true });
    this.isListening.set(true);
    this.toast.info('Orientation logging started');
  }

  /** Preserves existing template/API call site. */
  start(): Promise<void> {
    return this.startLogging();
  }

  stopLogging(): void {
    if (!this.isBrowser) {
      return;
    }
    window.removeEventListener('deviceorientation', this.onOrientationEvent);
    this.isListening.set(false);
  }

  /** Preserves existing template/API call site. */
  stop(): void {
    const wasListening = this.isListening();
    this.stopLogging();
    if (wasListening) {
      this.toast.info('Orientation logging stopped');
    }
  }

  clearSamples(): void {
    this.samples.set([]);
    this.errors.set([]);
    this.toast.info('Samples cleared');
  }

  /** Preserves existing template/API call site. */
  clear(): void {
    this.clearSamples();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  copyLatest(): void {
    const sample = this.latestSample();
    if (!sample) return;
    buCopyText(this.toast, formatOrientationSample(sample), 'Latest sample');
  }

  copyAllSamples(): void {
    buCopyText(this.toast, formatAllOrientationSamples(this.samples()), 'All samples');
  }

  downloadSamples(): void {
    if (!this.isBrowser || !this.samples().length) return;

    try {
      buDownloadJson(this.samples(), `orientation-samples-${buDownloadTimestamp()}.json`);
      this.toast.success('Samples downloaded');
    } catch {
      this.toast.error('Failed to download samples');
    }
  }

  ngOnDestroy(): void {
    this.stopLogging();
  }
}
