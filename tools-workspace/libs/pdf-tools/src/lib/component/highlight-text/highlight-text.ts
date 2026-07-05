import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-highlight-text',
  standalone: true,
  templateUrl: './highlight-text.html',
  styleUrls: ['./highlight-text.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HighlightTextComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Highlight PDF Text';
  readonly description = 'Search and highlight text passages in PDF documents with customizable highlight colors.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a searchable PDF to highlight text passages.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'Search keywords and apply yellow/green/custom highlights',
    'Multi-highlight support across pages',
    'Export highlighted PDF with annotations embedded',
    'Clear individual or all highlights',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a text-based PDF (not scanned images).',
    'Search for terms and click to highlight matches.',
    'Download the annotated PDF when done.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: false, text: 'Scanned image-only PDFs require OCR first.' },
    { accent: true, text: 'Highlights are saved as standard PDF annotations.' },
  ];
}
