import { FormControl, FormGroup } from '@angular/forms';

export type PomodoroTimerMode = 'work' | 'break' | 'longBreak';

export type PomodoroFormGroup = FormGroup<{
  workMinutes: FormControl<number>;
  breakMinutes: FormControl<number>;
  longBreakMinutes: FormControl<number>;
  longBreakInterval: FormControl<number>;
}>;

export interface PomodoroSettings {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
}
