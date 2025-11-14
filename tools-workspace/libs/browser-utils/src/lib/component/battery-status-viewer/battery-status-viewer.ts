import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-battery-status-viewer',
  standalone: true,
  templateUrl: './battery-status-viewer.html',
  styleUrls: ['./battery-status-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class BatteryStatusViewerComponent {
  constructor() {}
}
