import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-audio-player',
  standalone: true,
  templateUrl: './audio-player.html',
  styleUrls: ['./audio-player.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioPlayerComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Audio Player';
  readonly description = 'Play MP3, WAV, OGG, and other audio formats with waveform visualization and playlist support.';
  readonly uploadLabel = 'Audio upload';
  readonly uploadHint = 'Drop audio files to build a playlist — playback controls coming soon.';
  readonly acceptHint = 'MP3, WAV, OGG, M4A';

  readonly features: readonly string[] = [
    'Waveform scrubber with seek and volume controls',
    'Playlist queue with shuffle and repeat modes',
    'Playback speed adjustment (0.5×–2×)',
    'Keyboard shortcuts for play/pause and skip',
  ];

  readonly helpItems: readonly string[] = [
    'Upload one or more audio files to the playlist.',
    'Use the waveform to scrub to any position.',
    'Adjust speed and volume from the sidebar.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Audio is decoded locally — nothing is streamed to a server.' },
    { accent: false, text: 'Large files may take a moment to generate the waveform.' },
  ];
}
