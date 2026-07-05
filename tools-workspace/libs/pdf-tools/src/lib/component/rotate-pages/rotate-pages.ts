import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-rotate-pages',
  standalone: true,
  templateUrl: './rotate-pages.html',
  styleUrls: ['./rotate-pages.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotatePagesComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Rotate PDF Pages';
  readonly description = 'Rotate individual pages or entire documents by 90°, 180°, or 270° — non-destructive preview first.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a PDF file (max 100 MB) to rotate pages.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'Rotate all pages or a selected page range',
    '90° clockwise/counter-clockwise and 180° flip',
    'Thumbnail preview before applying changes',
    'Download rotated PDF without quality loss',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF and select pages to rotate.',
    'Preview thumbnails update before you apply.',
    'Download the modified PDF when satisfied.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Rotation uses pdf-lib — files stay on your device.' },
    { accent: false, text: 'Password-protected PDFs will require unlock first.' },
  ];
}
