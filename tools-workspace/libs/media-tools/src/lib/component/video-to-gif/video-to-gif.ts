import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-video-to-gif',
  standalone: true,
  templateUrl: './video-to-gif.html',
  styleUrls: ['./video-to-gif.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoToGifComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Video to GIF';
  readonly description = 'Convert video clips to animated GIFs with frame rate, size, and quality controls.';
  readonly uploadLabel = 'Video upload';
  readonly uploadHint = 'Drop MP4, WebM, or MOV files to convert to GIF.';
  readonly acceptHint = 'MP4, WebM, MOV';

  readonly features: readonly string[] = [
    'Trim start/end frames before conversion',
    'Adjust output width, FPS, and color palette',
    'Loop count and reverse playback options',
    'Preview GIF before download',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a short video clip (recommended under 30 s).',
    'Set trim range and GIF quality settings.',
    'Generate and download the animated GIF.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Conversion runs locally — longer clips take more time.' },
    { accent: false, text: 'Reduce FPS and width to keep GIF file size manageable.' },
  ];
}
