import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-audio-trimmer',
  standalone: true,
  templateUrl: './audio-trimmer.html',
  styleUrls: ['./audio-trimmer.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioTrimmerComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Audio Trimmer';
  readonly description = 'Select start and end points on a waveform to trim audio clips and export in common formats.';
  readonly uploadLabel = 'Audio upload';
  readonly uploadHint = 'Drop an audio file to open the trim editor.';
  readonly acceptHint = 'MP3, WAV, OGG';

  readonly features: readonly string[] = [
    'Visual waveform with draggable start/end handles',
    'Precise time input in ms or hh:mm:ss',
    'Fade-in and fade-out options',
    'Export trimmed clip as MP3 or WAV',
  ];

  readonly helpItems: readonly string[] = [
    'Upload an audio file to load the waveform.',
    'Drag handles or enter times to set the trim region.',
    'Preview and download the trimmed segment.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Trimming uses the Web Audio API in your browser.' },
    { accent: false, text: 'Lossy re-encoding may slightly reduce quality on MP3 export.' },
  ];
}
