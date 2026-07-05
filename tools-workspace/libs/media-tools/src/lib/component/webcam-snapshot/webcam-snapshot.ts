import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-webcam-snapshot',
  standalone: true,
  templateUrl: './webcam-snapshot.html',
  styleUrls: ['./webcam-snapshot.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebcamSnapshotComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Webcam Snapshot';
  readonly description = 'Capture photos from your webcam with countdown timer, mirror flip, and instant download.';
  readonly uploadLabel = 'Camera access';
  readonly uploadHint = 'Camera preview will appear here — permission required when available.';
  readonly acceptHint = 'Webcam';

  readonly features: readonly string[] = [
    'Live camera preview with device selector',
    'Countdown timer and mirror/flip option',
    'Capture stills as PNG or JPG',
    'Burst mode for multiple frames',
  ];

  readonly helpItems: readonly string[] = [
    'Allow camera access when prompted.',
    'Choose resolution and flip options.',
    'Click capture to save a snapshot.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Video stays on your device — no cloud upload.' },
    { accent: false, text: 'HTTPS is required for getUserMedia in most browsers.' },
  ];
}
