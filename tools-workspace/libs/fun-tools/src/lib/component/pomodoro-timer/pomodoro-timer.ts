import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import {
  POMODORO_DEFAULT_SETTINGS,
  POMODORO_RELATED_TOOLS,
  POMODORO_TICK_MS
} from '../../constants/pomodoro-timer.constants';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type {
  PomodoroFormGroup,
  PomodoroTimerMode
} from '../../types/pomodoro-timer.types';
import {
  computePomodoroProgress,
  formatPomodoroClock,
  getPomodoroCircleCircumference,
  getPomodoroCircleDashOffset,
  getPomodoroTotalSeconds,
  playPomodoroNotificationBeep,
  pomodoroCompletionToastMessage,
  pomodoroModeLabel,
  resolveNextPomodoroMode,
  resolvePomodoroSuggestion,
  sessionsUntilLongBreak
} from '../../utils/pomodoro-timer.utils';

@Component({
  selector: 'lib-pomodoro-timer',
  standalone: true,
  templateUrl: './pomodoro-timer.html',
  styleUrls: ['./pomodoro-timer.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PomodoroTimerComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: PomodoroFormGroup = this.fb.group({
    workMinutes: this.fb.control(POMODORO_DEFAULT_SETTINGS.workMinutes, { nonNullable: true }),
    breakMinutes: this.fb.control(POMODORO_DEFAULT_SETTINGS.breakMinutes, { nonNullable: true }),
    longBreakMinutes: this.fb.control(POMODORO_DEFAULT_SETTINGS.longBreakMinutes, {
      nonNullable: true
    }),
    longBreakInterval: this.fb.control(POMODORO_DEFAULT_SETTINGS.longBreakInterval, {
      nonNullable: true
    })
  });

  readonly timeRemaining = signal<number>(
    getPomodoroTotalSeconds('work', POMODORO_DEFAULT_SETTINGS)
  );
  readonly initialTime = signal<number>(
    getPomodoroTotalSeconds('work', POMODORO_DEFAULT_SETTINGS)
  );
  readonly isRunning = signal(false);
  readonly mode = signal<PomodoroTimerMode>('work');
  readonly completedPomodoros = signal(0);
  readonly currentSession = signal(0);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  private intervalId: number | null = null;

  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = POMODORO_RELATED_TOOLS;

  readonly progress = computed(() =>
    computePomodoroProgress(this.initialTime(), this.timeRemaining())
  );
  readonly isWorkMode = computed(() => this.mode() === 'work');
  readonly isBreakMode = computed(() => this.mode() === 'break' || this.mode() === 'longBreak');
  readonly progressRounded = computed(() => Math.round(this.progress()));
  readonly modeDisplayLabel = computed(() => pomodoroModeLabel(this.mode()));
  readonly sessionsUntilNextLongBreak = computed(() =>
    sessionsUntilLongBreak(
      this.currentSession(),
      this.form.controls.longBreakInterval.value
    )
  );

  readonly primarySuggestion = computed(() => {
    const suggestion = resolvePomodoroSuggestion({
      isRunning: this.isRunning(),
      mode: this.mode(),
      completedPomodoros: this.completedPomodoros()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

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
    }, POMODORO_TICK_MS);
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
    const completedMode = this.mode();
    this.stopTimer();

    if (completedMode === 'work') {
      this.completedPomodoros.update((count) => count + 1);
      this.currentSession.update((session) => session + 1);

      const longBreakInterval = this.form.controls.longBreakInterval.value;
      this.mode.set(
        resolveNextPomodoroMode('work', this.currentSession(), longBreakInterval)
      );
    } else {
      this.mode.set(resolveNextPomodoroMode(completedMode, this.currentSession(), 0));
    }

    this.resetTimer();
    playPomodoroNotificationBeep();
    this.toast.info(pomodoroCompletionToastMessage(completedMode));
  }

  private getTotalSeconds(): number {
    return getPomodoroTotalSeconds(this.mode(), this.form.getRawValue());
  }

  formatTime(totalSeconds: number): string {
    return formatPomodoroClock(totalSeconds);
  }

  formatTimeDisplay(): string {
    return this.formatTime(this.timeRemaining());
  }

  getCircleCircumference(): number {
    return getPomodoroCircleCircumference();
  }

  getCircleDashOffset(): number {
    return getPomodoroCircleDashOffset(this.progress());
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

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }
}
