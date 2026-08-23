import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-audio-trimmer',
  standalone: true,
  templateUrl: './audio-trimmer.html',
  styleUrls: ['./audio-trimmer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class AudioTrimmerComponent {
  constructor() {}
}
