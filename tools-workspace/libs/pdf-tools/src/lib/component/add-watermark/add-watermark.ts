import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-add-watermark',
  standalone: true,
  templateUrl: './add-watermark.html',
  styleUrls: ['./add-watermark.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddWatermarkComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Add Watermark to PDF';
  readonly description = 'Stamp text or image watermarks across all pages — adjust opacity, rotation, and position.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a PDF plus optional logo/image for watermark overlay.';
  readonly acceptHint = 'PDF, PNG, JPG';

  readonly features: readonly string[] = [
    'Text watermarks with custom font, size, and color',
    'Image/logo watermarks with opacity control',
    'Tile, center, or diagonal placement options',
    'Apply to all pages or a selected range',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF and configure text or image watermark.',
    'Preview opacity and placement on sample pages.',
    'Download the watermarked PDF.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Watermarking is applied client-side with pdf-lib.' },
    { accent: false, text: 'Semi-transparent watermarks work best for readability.' },
  ];
}
