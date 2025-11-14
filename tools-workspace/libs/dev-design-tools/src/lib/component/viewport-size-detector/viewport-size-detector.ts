import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-viewport-size-detector',
  standalone: true,
  templateUrl: './viewport-size-detector.html',
  styleUrls: ['./viewport-size-detector.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ViewportSizeDetectorComponent {
  constructor() {}
}
