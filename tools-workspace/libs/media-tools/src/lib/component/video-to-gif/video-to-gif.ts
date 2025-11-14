import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-video-to-gif',
  standalone: true,
  templateUrl: './video-to-gif.html',
  styleUrls: ['./video-to-gif.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class VideoToGifComponent {
  constructor() {}
}
