import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-webcam-snapshot',
  standalone: true,
  templateUrl: './webcam-snapshot.html',
  styleUrls: ['./webcam-snapshot.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class WebcamSnapshotComponent {
  constructor() {}
}
