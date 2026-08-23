import { ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

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
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeviceOrientationLoggerComponent implements OnDestroy {
  readonly supported = 'DeviceOrientationEvent' in window;
  readonly samples = signal<OrientationSample[]>([]);
  readonly listening = signal(false);
  readonly errors = signal<string[]>([]);

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
}
