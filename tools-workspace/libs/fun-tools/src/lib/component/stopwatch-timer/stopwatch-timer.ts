import { ChangeDetectionStrategy, Component, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

interface LapTime {
  lapNumber: number;
  lapTime: number; // in milliseconds
  totalTime: number; // in milliseconds
  timestamp: number;
}

@Component({
  selector: 'lib-stopwatch-timer',
  standalone: true,
  templateUrl: './stopwatch-timer.html',
  styleUrls: ['./stopwatch-timer.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StopwatchTimerComponent implements OnDestroy {
  readonly elapsedTime = signal<number>(0); // in milliseconds
  readonly isRunning = signal(false);
  readonly lapTimes = signal<LapTime[]>([]);
  readonly startTime = signal<number | null>(null);
  readonly lastLapTime = signal<number>(0); // in milliseconds

  private intervalId: number | null = null;

  readonly formattedTime = computed(() => this.formatTime(this.elapsedTime()));
  readonly hasLaps = computed(() => this.lapTimes().length > 0);

  readonly stats = computed(() => {
    const laps = this.lapTimes();
    if (laps.length === 0) {
      return { count: 0, fastest: 0, slowest: 0, average: 0 };
    }

    const lapDurations = laps.map((lap) => lap.lapTime);
    const sum = lapDurations.reduce((acc, val) => acc + val, 0);
    return {
      count: laps.length,
      fastest: Math.min(...lapDurations),
      slowest: Math.max(...lapDurations),
      average: sum / lapDurations.length
    };
  });

  constructor() {
    // Initialize
  }

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
    const start = now - elapsed;
    this.startTime.set(start);

    this.intervalId = window.setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - start;
      this.elapsedTime.set(elapsed);
    }, 10); // Update every 10ms for smooth display
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
    const lapTime = currentTime - this.lastLapTime();
    const lapNumber = this.lapTimes().length + 1;

    this.lapTimes.update((laps) => [
      {
        lapNumber,
        lapTime,
        totalTime: currentTime,
        timestamp: Date.now()
      },
      ...laps
    ]);

    this.lastLapTime.set(currentTime);
  }

  formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  formatLapTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  clearLaps(): void {
    this.lapTimes.set([]);
    this.lastLapTime.set(0);
  }
}
