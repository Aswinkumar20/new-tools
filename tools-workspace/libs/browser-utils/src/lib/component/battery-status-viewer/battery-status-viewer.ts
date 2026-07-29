import {
  AfterViewInit,
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
import type { BuRelatedToolLink, BuToolSuggestion } from '../../shared/bu-tool-suggestion.model';
import {
  BATTERY_HISTORY_LIMIT,
  BATTERY_MANAGER_EVENTS,
  BATTERY_RELATED_TOOLS
} from '../../constants/battery-status.constants';
import type { BatteryManager, BatteryNavigator, BatteryStatusSnapshot } from '../../types/battery-status.types';
import {
  buildBatteryStatusCopyLines,
  buildBatteryStatusJsonPayload,
  formatBatteryHistoryEntry,
  formatBatteryPercentage,
  formatBatteryTime,
  formatBatteryTimestamp,
  isBatteryApiSupported,
  isCriticalBatteryLevel,
  isLowBatteryLevel,
  isMeaningfulBatteryChange,
  normalizeBatteryTime,
  resolveBatterySuggestion
} from '../../utils/battery-status.utils';

@Component({
  selector: 'lib-battery-status-viewer',
  standalone: true,
  templateUrl: './battery-status-viewer.html',
  styleUrls: ['./battery-status-viewer.scss'],
  imports: [RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BatteryStatusViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly historyLimit = BATTERY_HISTORY_LIMIT;
  readonly relatedTools: ReadonlyArray<BuRelatedToolLink> = BATTERY_RELATED_TOOLS;

  readonly formatPercentage = formatBatteryPercentage;
  readonly formatTime = formatBatteryTime;
  readonly formatTimestamp = formatBatteryTimestamp;

  readonly isSupported = signal(false);
  readonly currentStatus = signal<BatteryStatusSnapshot | null>(null);
  readonly history = signal<BatteryStatusSnapshot[]>([]);
  readonly isMonitoring = signal(false);
  readonly isLoading = signal(false);
  readonly errors = signal<string[]>([]);
  readonly shouldLogHistory = signal(true);
  readonly dismissedSuggestionId = signal<string | null>(null);

  private batteryManager: BatteryManager | null = null;
  private readonly onBatteryManagerEvent = () => this.syncBatteryStatus();

  readonly batteryPercentage = computed(() => {
    const status = this.currentStatus();
    return status ? Math.round(status.level * 100) : null;
  });

  readonly batteryLevel = computed(() => this.currentStatus()?.level ?? 0);

  readonly isCharging = computed(() => this.currentStatus()?.charging ?? false);

  readonly hasHistory = computed(() => this.history().length > 0);

  readonly isLowBattery = computed(() => isLowBatteryLevel(this.currentStatus()));

  readonly isCriticalBattery = computed(() => isCriticalBatteryLevel(this.currentStatus()));

  readonly primarySuggestion = computed<BuToolSuggestion | null>(() => {
    const suggestion = resolveBatterySuggestion(this.isSupported(), this.currentStatus());
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  ngAfterViewInit(): void {
    const supported = isBatteryApiSupported(this.isBrowser, this.getBatteryNavigator());
    this.isSupported.set(supported);
    if (supported) {
      void this.loadBatteryManager();
    }
  }

  private getBatteryNavigator(): BatteryNavigator | null {
    if (!this.isBrowser) {
      return null;
    }
    return navigator as BatteryNavigator;
  }

  private async loadBatteryManager(): Promise<void> {
    this.isLoading.set(true);
    this.errors.set([]);

    try {
      const nav = this.getBatteryNavigator();
      let battery: BatteryManager | null = null;

      if (nav && typeof nav.getBattery === 'function') {
        battery = await nav.getBattery();
      } else if (nav?.battery) {
        battery = nav.battery;
      }

      if (battery) {
        this.batteryManager = battery;
        this.syncBatteryStatus(true);
        this.startMonitoring();
      } else {
        this.errors.set(['Battery manager was unavailable even though the API is present.']);
      }
    } catch (error) {
      this.errors.set([
        error instanceof Error ? error.message : 'Failed to access battery API.'
      ]);
    } finally {
      this.isLoading.set(false);
    }
  }

  startMonitoring(): void {
    if (!this.batteryManager || this.isMonitoring()) {
      return;
    }

    for (const eventName of BATTERY_MANAGER_EVENTS) {
      this.batteryManager.addEventListener(eventName, this.onBatteryManagerEvent);
    }
    this.isMonitoring.set(true);
  }

  stopMonitoring(): void {
    if (!this.batteryManager || !this.isMonitoring()) {
      return;
    }

    for (const eventName of BATTERY_MANAGER_EVENTS) {
      this.batteryManager.removeEventListener(eventName, this.onBatteryManagerEvent);
    }
    this.isMonitoring.set(false);
  }

  toggleMonitoring(): void {
    if (this.isMonitoring()) {
      this.stopMonitoring();
      this.toast.info('Live updates paused');
      return;
    }

    this.startMonitoring();
    this.syncBatteryStatus();
    this.toast.info('Live updates resumed');
  }

  private syncBatteryStatus(forceHistory = false): void {
    if (!this.batteryManager) {
      return;
    }

    const status: BatteryStatusSnapshot = {
      charging: this.batteryManager.charging,
      chargingTime: normalizeBatteryTime(this.batteryManager.chargingTime),
      dischargingTime: normalizeBatteryTime(this.batteryManager.dischargingTime),
      level: this.batteryManager.level,
      timestamp: Date.now()
    };

    const previous = this.currentStatus();
    this.currentStatus.set(status);

    if (!this.shouldLogHistory()) {
      return;
    }

    if (forceHistory || isMeaningfulBatteryChange(previous, status)) {
      this.history.update((entries) => [status, ...entries].slice(0, BATTERY_HISTORY_LIMIT));
    }
  }

  refreshStatus(): void {
    this.errors.set([]);
    if (this.isSupported() && !this.batteryManager) {
      void this.loadBatteryManager();
      return;
    }
    if (this.batteryManager) {
      this.syncBatteryStatus(true);
      this.toast.info('Battery status refreshed');
    }
  }

  clearHistory(): void {
    this.history.set([]);
    this.errors.set([]);
    this.toast.info('History cleared');
  }

  toggleLogHistory(enabled: boolean): void {
    this.shouldLogHistory.set(enabled);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  copyStatus(): void {
    const status = this.currentStatus();
    if (!status) return;
    buCopyText(this.toast, buildBatteryStatusCopyLines(status).join('\n'), 'Battery status');
  }

  copyJson(): void {
    const status = this.currentStatus();
    if (!status) return;
    buCopyText(
      this.toast,
      JSON.stringify(buildBatteryStatusJsonPayload(status), null, 2),
      'Battery status JSON'
    );
  }

  copyHistory(): void {
    const entries = this.history();
    if (!entries.length) return;
    buCopyText(
      this.toast,
      entries.map((entry) => formatBatteryHistoryEntry(entry)).join('\n'),
      'Battery history'
    );
  }

  downloadHistory(): void {
    if (!this.isBrowser || !this.history().length) return;

    try {
      buDownloadJson(this.history(), `battery-history-${buDownloadTimestamp()}.json`);
      this.toast.success('History downloaded');
    } catch {
      this.toast.error('Failed to download history');
    }
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}
