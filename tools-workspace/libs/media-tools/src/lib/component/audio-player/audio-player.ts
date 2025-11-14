import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-audio-player',
  standalone: true,
  templateUrl: './audio-player.html',
  styleUrls: ['./audio-player.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class AudioPlayerComponent {
  constructor() {}
}
