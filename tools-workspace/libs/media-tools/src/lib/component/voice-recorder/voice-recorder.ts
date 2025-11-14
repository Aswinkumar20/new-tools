import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-voice-recorder',
  standalone: true,
  templateUrl: './voice-recorder.html',
  styleUrls: ['./voice-recorder.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class VoiceRecorderComponent {
  constructor() {}
}
