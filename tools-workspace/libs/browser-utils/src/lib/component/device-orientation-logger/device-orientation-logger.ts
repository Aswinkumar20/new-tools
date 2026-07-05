import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface OrientationSample {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  timestamp: number;
}

@Component({
  selector: 'lib-device-orientation-logger',
  standalone: true,
  templateUrl: './device-orientation-logger.html',
  styleUrls: ['./device-orientation-logger.scss'],
  imports: [CommonModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeviceOrientationLoggerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  readonly supported = 'DeviceOrientationEvent' in window;
  readonly samples = signal<OrientationSample[]>([]);
  readonly listening = signal(false);
  readonly errors = signal<string[]>([]);

  readonly latestSample = computed(() => (this.samples().length ? this.samples()[0] : null));

  private readonly handler = (event: DeviceOrientationEvent) => {
    const sample: OrientationSample = {
      alpha: event.alpha ?? null,
      beta: event.beta ?? null,
      gamma: event.gamma ?? null,
      absolute: event.absolute ?? false,
      timestamp: Date.now()
    };
    this.samples.update((current) => [sample, ...current].slice(0, 50));
  };

  async start(): Promise<void> {
    this.errors.set([]);
    if (!this.supported) {
      this.errors.set(['Device orientation is not supported in this browser.']);
      return;
    }

    try {
      const anyWindow = window as any;
      if (
        typeof anyWindow.DeviceOrientationEvent !== 'undefined' &&
        typeof anyWindow.DeviceOrientationEvent.requestPermission === 'function'
      ) {
        // iOS permission flow
        const permission = await anyWindow.DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          this.errors.set(['Permission to access device orientation was denied.']);
          return;
        }
      }
    } catch {
      // ignore permission errors; some platforms do not require this
    }

    window.addEventListener('deviceorientation', this.handler, { passive: true });
    this.listening.set(true);
  }

  stop(): void {
    window.removeEventListener('deviceorientation', this.handler);
    this.listening.set(false);
  }

  clear(): void {
    this.samples.set([]);
    this.errors.set([]);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  formatAngle(value: number | null): string {
    return value !== null ? `${value.toFixed(1)}°` : 'N/A';
  }

  copyLatest(): void {
    const sample = this.latestSample();
    if (!sample) return;
    this.copyText(this.formatSample(sample), 'Latest sample');
  }

  copyAllSamples(): void {
    const text = this.samples().map((s) => this.formatSample(s)).join('\n');
    this.copyText(text, 'All samples');
  }

  private formatSample(sample: OrientationSample): string {
    return `[${this.formatTimestamp(sample.timestamp)}] α=${this.formatAngle(sample.alpha)} β=${this.formatAngle(sample.beta)} γ=${this.formatAngle(sample.gamma)} (${sample.absolute ? 'absolute' : 'relative'})`;
  }

  private copyText(text: string, label: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }
}
