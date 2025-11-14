import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-network-speed-test',
  standalone: true,
  templateUrl: './network-speed-test.html',
  styleUrls: ['./network-speed-test.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class NetworkSpeedTestComponent {
  constructor() {}
}
