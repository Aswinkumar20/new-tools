import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface BatteryStatus {
  charging: boolean;
  chargingTime: number | null;
  dischargingTime: number | null;
  level: number;
  timestamp: number;
}

interface BatteryManager {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

@Component({
  selector: 'lib-battery-status-viewer',
  standalone: true,
  templateUrl: './battery-status-viewer.html',
  styleUrls: ['./battery-status-viewer.scss'],
  imports: [CommonModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BatteryStatusViewerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  readonly supported = 'getBattery' in navigator || ('battery' in navigator && (navigator as any).battery);
  readonly currentStatus = signal<BatteryStatus | null>(null);
  readonly history = signal<BatteryStatus[]>([]);
  readonly monitoring = signal(false);
  readonly errors = signal<string[]>([]);

  private batteryManager: BatteryManager | null = null;
  private readonly chargingChangeHandler = () => this.updateStatus();
  private readonly chargingTimeChangeHandler = () => this.updateStatus();
  private readonly dischargingTimeChangeHandler = () => this.updateStatus();
  private readonly levelChangeHandler = () => this.updateStatus();

  readonly batteryPercentage = computed(() => {
    const status = this.currentStatus();
    return status ? Math.round(status.level * 100) : null;
  });

  readonly batteryLevel = computed(() => {
    const status = this.currentStatus();
    return status ? status.level : 0;
  });

  readonly isCharging = computed(() => {
    const status = this.currentStatus();
    return status?.charging ?? false;
  });

  readonly hasHistory = computed(() => this.history().length > 0);

  constructor() {
    if (this.supported) {
      this.initializeBattery();
    }
  }

  private async initializeBattery(): Promise<void> {
    try {
      let battery: BatteryManager | null = null;

      if ('getBattery' in navigator) {
        battery = (await (navigator as any).getBattery()) as BatteryManager;
      } else if ('battery' in navigator) {
        battery = (navigator as any).battery as BatteryManager;
      }

      if (battery) {
        this.batteryManager = battery;
        this.updateStatus();
        this.startMonitoring();
      }
    } catch (e) {
      this.errors.set([e instanceof Error ? e.message : 'Failed to access battery API.']);
    }
  }

  startMonitoring(): void {
    if (!this.batteryManager || this.monitoring()) {
      return;
    }

    this.batteryManager.addEventListener('chargingchange', this.chargingChangeHandler);
    this.batteryManager.addEventListener('chargingtimechange', this.chargingTimeChangeHandler);
    this.batteryManager.addEventListener('dischargingtimechange', this.dischargingTimeChangeHandler);
    this.batteryManager.addEventListener('levelchange', this.levelChangeHandler);

    this.monitoring.set(true);
  }

  stopMonitoring(): void {
    if (!this.batteryManager || !this.monitoring()) {
      return;
    }

    this.batteryManager.removeEventListener('chargingchange', this.chargingChangeHandler);
    this.batteryManager.removeEventListener('chargingtimechange', this.chargingTimeChangeHandler);
    this.batteryManager.removeEventListener('dischargingtimechange', this.dischargingTimeChangeHandler);
    this.batteryManager.removeEventListener('levelchange', this.levelChangeHandler);

    this.monitoring.set(false);
  }

  private updateStatus(): void {
    if (!this.batteryManager) {
      return;
    }

    const status: BatteryStatus = {
      charging: this.batteryManager.charging,
      chargingTime: this.batteryManager.chargingTime === Infinity ? null : this.batteryManager.chargingTime,
      dischargingTime: this.batteryManager.dischargingTime === Infinity ? null : this.batteryManager.dischargingTime,
      level: this.batteryManager.level,
      timestamp: Date.now()
    };

    this.currentStatus.set(status);
    this.history.update((current) => [status, ...current].slice(0, 50));
  }

  refresh(): void {
    this.errors.set([]);
    if (this.supported && !this.batteryManager) {
      this.initializeBattery();
    } else if (this.batteryManager) {
      this.updateStatus();
    }
  }

  clearHistory(): void {
    this.history.set([]);
    this.errors.set([]);
  }

  copyStatus(): void {
    const status = this.currentStatus();
    if (!status) return;
    const lines = [
      `Level: ${this.formatPercentage(status.level)}`,
      `Charging: ${status.charging ? 'Yes' : 'No'}`,
    ];
    if (status.charging && status.chargingTime !== null) {
      lines.push(`Time to full: ${this.formatTime(status.chargingTime)}`);
    }
    if (!status.charging && status.dischargingTime !== null) {
      lines.push(`Time until empty: ${this.formatTime(status.dischargingTime)}`);
    }
    this.copyText(lines.join('\n'), 'Battery status');
  }

  copyHistory(): void {
    const entries = this.history();
    if (!entries.length) return;
    const text = entries
      .map((e) => {
        const parts = [
          `[${this.formatTimestamp(e.timestamp)}]`,
          `${this.formatPercentage(e.level)}`,
          e.charging ? 'Charging' : 'Discharging',
        ];
        if (e.charging && e.chargingTime !== null) {
          parts.push(`to full: ${this.formatTime(e.chargingTime)}`);
        }
        if (!e.charging && e.dischargingTime !== null) {
          parts.push(`until empty: ${this.formatTime(e.dischargingTime)}`);
        }
        return parts.join(' · ');
      })
      .join('\n');
    this.copyText(text, 'Battery history');
  }

  private copyText(text: string, label: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  formatTime(seconds: number | null): string {
    if (seconds === null || seconds === Infinity) {
      return 'N/A';
    }
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  formatPercentage(level: number): string {
    return `${Math.round(level * 100)}%`;
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}
