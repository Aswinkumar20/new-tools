import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import {
  STOPWATCH_RELATED_TOOLS,
  STOPWATCH_TICK_MS
} from '../../constants/stopwatch-timer.constants';
import { ftCopyText } from '../../shared/ft-clipboard.util';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type { LapTime } from '../../types/stopwatch-timer.types';
import {
  computeStartTimestamp,
  computeStopwatchLapStats,
  createLapEntry,
  formatLapsCopyText,
  formatStopwatchLapTime,
  formatStopwatchTime,
  resolveStopwatchSuggestion
} from '../../utils/stopwatch-timer.utils';

@Component({
  selector: 'lib-stopwatch-timer',
  standalone: true,
  templateUrl: './stopwatch-timer.html',
  styleUrls: ['./stopwatch-timer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StopwatchTimerComponent implements OnDestroy {
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly elapsedTime = signal<number>(0);
  readonly isRunning = signal(false);
  readonly lapTimes = signal<LapTime[]>([]);
  readonly startTime = signal<number | null>(null);
  readonly lastLapTime = signal<number>(0);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  private intervalId: number | null = null;

  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = STOPWATCH_RELATED_TOOLS;

  readonly formattedTime = computed(() => formatStopwatchTime(this.elapsedTime()));
  readonly hasLaps = computed(() => this.lapTimes().length > 0);
  readonly stats = computed(() => computeStopwatchLapStats(this.lapTimes()));

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveStopwatchSuggestion({
      isRunning: this.isRunning(),
      elapsedMs: this.elapsedTime(),
      lapCount: this.lapTimes().length
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  ngOnDestroy(): void {
    this.stop();
  }

  start(): void {
    if (this.isRunning()) {
      return;
    }

    this.isRunning.set(true);
    const now = Date.now();
    const elapsed = this.elapsedTime();
    const start = computeStartTimestamp(now, elapsed);
    this.startTime.set(start);

    this.intervalId = window.setInterval(() => {
      const currentTime = Date.now();
      this.elapsedTime.set(currentTime - start);
    }, STOPWATCH_TICK_MS);
  }

  stop(): void {
    this.pause();
  }

  pause(): void {
    this.isRunning.set(false);
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset(): void {
    this.pause();
    this.elapsedTime.set(0);
    this.startTime.set(null);
    this.lapTimes.set([]);
    this.lastLapTime.set(0);
  }

  lap(): void {
    if (!this.isRunning() && this.elapsedTime() === 0) {
      return;
    }

    const currentTime = this.elapsedTime();
    const entry = createLapEntry(currentTime, this.lastLapTime(), this.lapTimes().length);
    this.lapTimes.update((laps) => [entry, ...laps]);
    this.lastLapTime.set(currentTime);
  }

  formatTime(milliseconds: number): string {
    return formatStopwatchTime(milliseconds);
  }

  formatLapTime(milliseconds: number): string {
    return formatStopwatchLapTime(milliseconds);
  }

  clearLaps(): void {
    this.lapTimes.set([]);
    this.lastLapTime.set(0);
  }

  async copyTime(): Promise<void> {
    await ftCopyText(this.toast, this.formattedTime(), 'Time');
  }

  async copyLaps(): Promise<void> {
    const text = formatLapsCopyText(this.lapTimes());
    if (!text) {
      return;
    }
    await ftCopyText(this.toast, text, 'Lap times');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }
}
