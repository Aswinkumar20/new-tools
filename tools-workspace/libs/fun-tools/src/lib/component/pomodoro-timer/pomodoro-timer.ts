import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type TimerMode = 'work' | 'break' | 'longBreak';

type PomodoroFormGroup = FormGroup<{
  workMinutes: FormControl<number>;
  breakMinutes: FormControl<number>;
  longBreakMinutes: FormControl<number>;
  longBreakInterval: FormControl<number>;
}>;

@Component({
  selector: 'lib-pomodoro-timer',
  standalone: true,
  templateUrl: './pomodoro-timer.html',
  styleUrls: ['./pomodoro-timer.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PomodoroTimerComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: PomodoroFormGroup = this.fb.group({
    workMinutes: this.fb.control(25, { nonNullable: true }),
    breakMinutes: this.fb.control(5, { nonNullable: true }),
    longBreakMinutes: this.fb.control(15, { nonNullable: true }),
    longBreakInterval: this.fb.control(4, { nonNullable: true })
  });

  readonly timeRemaining = signal<number>(25 * 60); // in seconds
  readonly initialTime = signal<number>(25 * 60); // in seconds
  readonly isRunning = signal(false);
  readonly mode = signal<TimerMode>('work');
  readonly completedPomodoros = signal(0);
  readonly currentSession = signal(0);
  readonly errors = signal<string[]>([]);

  private intervalId: number | null = null;

  readonly minutes = computed(() => Math.floor(this.timeRemaining() / 60));
  readonly seconds = computed(() => this.timeRemaining() % 60);
  readonly progress = computed(() => {
    const total = this.initialTime();
    const remaining = this.timeRemaining();
    return total > 0 ? ((total - remaining) / total) * 100 : 0;
  });
  readonly isWorkMode = computed(() => this.mode() === 'work');
  readonly isBreakMode = computed(() => this.mode() === 'break' || this.mode() === 'longBreak');
  readonly progressRounded = computed(() => Math.round(this.progress()));

  constructor() {
    this.resetTimer();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  startTimer(): void {
    if (this.isRunning()) {
      return;
    }

    this.isRunning.set(true);
    this.intervalId = window.setInterval(() => {
      const remaining = this.timeRemaining();
      if (remaining <= 0) {
        this.completeTimer();
        return;
      }
      this.timeRemaining.set(remaining - 1);
    }, 1000);
  }

  pauseTimer(): void {
    this.isRunning.set(false);
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  stopTimer(): void {
    this.pauseTimer();
  }

  resetTimer(): void {
    this.stopTimer();
    const total = this.getTotalSeconds();
    this.initialTime.set(total);
    this.timeRemaining.set(total);
  }

  skipTimer(): void {
    this.completeTimer();
  }

  private completeTimer(): void {
    this.stopTimer();

    if (this.mode() === 'work') {
      this.completedPomodoros.update((count) => count + 1);
      this.currentSession.update((session) => session + 1);

      const longBreakInterval = this.form.controls.longBreakInterval.value;
      if (this.currentSession() % longBreakInterval === 0) {
        this.mode.set('longBreak');
      } else {
        this.mode.set('break');
      }
    } else {
      this.mode.set('work');
    }

    this.resetTimer();

    // Play notification sound (if supported)
    this.playNotification();
  }

  private playNotification(): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
      // Audio not supported or failed
    }
  }

  private getTotalSeconds(): number {
    const mode = this.mode();
    if (mode === 'work') {
      return this.form.controls.workMinutes.value * 60;
    } else if (mode === 'longBreak') {
      return this.form.controls.longBreakMinutes.value * 60;
    } else {
      return this.form.controls.breakMinutes.value * 60;
    }
  }

  formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatTimeDisplay(): string {
    return this.formatTime(this.timeRemaining());
  }

  getCircleCircumference(): number {
    return 2 * Math.PI * 45; // radius is 45
  }

  getCircleDashOffset(): number {
    const circumference = this.getCircleCircumference();
    const progressPercent = this.progress() / 100;
    return circumference * (1 - progressPercent);
  }

  resetStats(): void {
    this.completedPomodoros.set(0);
    this.currentSession.set(0);
    this.mode.set('work');
    this.resetTimer();
  }

  onSettingsChange(): void {
    if (!this.isRunning()) {
      this.resetTimer();
    }
  }
}
