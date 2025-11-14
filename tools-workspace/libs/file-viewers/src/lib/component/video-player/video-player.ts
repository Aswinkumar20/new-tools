import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-video-player',
  standalone: true,
  templateUrl: './video-player.html',
  styleUrls: ['./video-player.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class VideoPlayerComponent {
  constructor() {}
}
