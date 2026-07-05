import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-video-player',
  standalone: true,
  templateUrl: './video-player.html',
  styleUrls: ['./video-player.scss'],
  imports: [CommonModule, FormsModule, Navigation, TooltipDirective]
})
export class VideoPlayerComponent {
  readonly assetService = inject(AssetService);
}
