import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-pomodoro-timer',
  standalone: true,
  templateUrl: './pomodoro-timer.html',
  styleUrls: ['./pomodoro-timer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PomodoroTimerComponent {
  constructor() {}
}
