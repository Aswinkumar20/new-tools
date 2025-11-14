import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-stopwatch-timer',
  standalone: true,
  templateUrl: './stopwatch-timer.html',
  styleUrls: ['./stopwatch-timer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class StopwatchTimerComponent {
  constructor() {}
}
