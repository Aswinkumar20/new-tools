import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

interface SpeedTestResult {
  url: string;
  bytes: number;
  durationMs: number;
  mbps: number;
  timestamp: number;
  error?: string;
}

type SpeedTestFormGroup = FormGroup<{
  url: FormControl<string>;
  sizeBytes: FormControl<number>;
  runs: FormControl<number>;
}>;

@Component({
  selector: 'lib-network-speed-test',
  standalone: true,
  templateUrl: './network-speed-test.html',
  styleUrls: ['./network-speed-test.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkSpeedTestComponent {
  private readonly fb = inject(FormBuilder);

  readonly form: SpeedTestFormGroup = this.fb.group({
    url: this.fb.control('https://speed.hetzner.de/1MB.bin', { nonNullable: true }),
    sizeBytes: this.fb.control(1_000_000, { nonNullable: true }),
    runs: this.fb.control(1, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly running = signal(false);
  readonly results = signal<SpeedTestResult[]>([]);

  readonly hasResults = computed(() => this.results().length > 0);
  readonly lastResult = computed(() => (this.results().length ? this.results()[0] : null));
  readonly avgMbps = computed(() => {
    if (!this.results().length) return 0;
    const sum = this.results().reduce((acc, r) => acc + r.mbps, 0);
    return sum / this.results().length;
  });

  async runTest(): Promise<void> {
    this.errors.set([]);

    const { url, sizeBytes, runs } = this.form.getRawValue();
    if (!url.trim()) {
      this.errors.set(['Enter a URL to download from.']);
      return;
    }
    if (sizeBytes <= 0) {
      this.errors.set(['Expected size must be greater than 0 bytes.']);
      return;
    }
    if (runs < 1 || runs > 5) {
      this.errors.set(['Runs must be between 1 and 5.']);
      return;
    }

    this.running.set(true);
    const newResults: SpeedTestResult[] = [];

    try {
      for (let i = 0; i < runs; i++) {
        const start = performance.now();
        let bytesDownloaded = 0;
        let error: string | undefined;

        try {
          const response = await fetch(url, { cache: 'no-store' });
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Response body not readable.');
          }
          // Consume the stream to measure bytes
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytesDownloaded += value?.length ?? 0;
          }
        } catch (e) {
          error = e instanceof Error ? e.message : 'Unknown error during download.';
        }

        const durationMs = performance.now() - start;
        const usedBytes = bytesDownloaded || sizeBytes;
        const mbps = durationMs > 0 ? (usedBytes * 8) / (durationMs / 1000) / 1_000_000 : 0;

        newResults.unshift({
          url,
          bytes: usedBytes,
          durationMs,
          mbps,
          timestamp: Date.now(),
          ...(error ? { error } : {})
        });

        if (error) {
          this.errors.set([`Run ${i + 1} failed: ${error}`]);
          break;
        }
      }

      if (newResults.length) {
        this.results.set([...newResults, ...this.results()].slice(0, 20));
      }
    } finally {
      this.running.set(false);
    }
  }

  clearResults(): void {
    this.results.set([]);
    this.errors.set([]);
  }

  formatMbps(mbps: number): string {
    return `${mbps.toFixed(2)} Mbps`;
  }

  formatMs(ms: number): string {
    return `${ms.toFixed(0)} ms`;
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  formatBytes(bytes: number): string {
    return `${bytes.toFixed(2)} bytes`;
  }

  formatUrl(url: string): string {
    return url;
  }

  formatError(error: string): string {
    return error;
  }
}
