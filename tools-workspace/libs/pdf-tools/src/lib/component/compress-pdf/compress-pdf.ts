import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-compress-pdf',
  standalone: true,
  templateUrl: './compress-pdf.html',
  styleUrls: ['./compress-pdf.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompressPdfComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Compress PDF';
  readonly description = 'Reduce PDF file size by optimizing images, removing unused objects, and choosing quality presets.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a PDF to analyze size and apply compression.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'Quality presets: high, balanced, and maximum compression',
    'Image downsampling and JPEG re-encoding',
    'Before/after size comparison with percent saved',
    'Batch compress multiple PDFs',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF to see current file size breakdown.',
    'Pick a compression preset and preview estimated savings.',
    'Download the optimized PDF.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Compression runs locally — quality vs. size is your choice.' },
    { accent: false, text: 'Text-only PDFs may see minimal size reduction.' },
  ];
}
