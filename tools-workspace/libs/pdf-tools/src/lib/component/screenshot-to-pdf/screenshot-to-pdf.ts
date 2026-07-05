import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-screenshot-to-pdf',
  standalone: true,
  templateUrl: './screenshot-to-pdf.html',
  styleUrls: ['./screenshot-to-pdf.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScreenshotToPdfComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Screenshot to PDF';
  readonly description = 'Combine screenshots or images into a single PDF — ideal for documentation and bug reports.';
  readonly uploadLabel = 'Image upload';
  readonly uploadHint = 'Drag PNG, JPG, or WebP screenshots — multiple files supported.';
  readonly acceptHint = 'PNG, JPG, WebP';

  readonly features: readonly string[] = [
    'Batch import with drag-and-drop reordering',
    'One image per page or tiled grid layouts',
    'Optional captions and margin padding',
    'Fit-to-page or original resolution export',
  ];

  readonly helpItems: readonly string[] = [
    'Upload one or more screenshots and arrange their order.',
    'Choose one-image-per-page or a contact-sheet grid.',
    'Download a merged PDF when the preview looks correct.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Images never leave your device during conversion.' },
    { accent: false, text: 'Recommended max 50 MB total upload size.' },
  ];
}
