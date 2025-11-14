import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-device-orientation-logger',
  standalone: true,
  templateUrl: './device-orientation-logger.html',
  styleUrls: ['./device-orientation-logger.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class DeviceOrientationLoggerComponent {
  constructor() {}
}
