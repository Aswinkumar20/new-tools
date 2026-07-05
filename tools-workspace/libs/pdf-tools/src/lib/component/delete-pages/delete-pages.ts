import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-delete-pages',
  standalone: true,
  templateUrl: './delete-pages.html',
  styleUrls: ['./delete-pages.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeletePagesComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Delete PDF Pages';
  readonly description = 'Remove unwanted pages from a PDF — select individually, by range, or via thumbnail multi-select.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a PDF to pick pages for removal.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'Delete by page number, range, or thumbnail selection',
    'Preview remaining document before export',
    'Undo last deletion in session',
    'Download trimmed PDF instantly',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF and select pages to remove.',
    'Review the remaining page count.',
    'Download the trimmed PDF.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Original file is unchanged until you download the result.' },
    { accent: false, text: 'Always verify page numbers against the thumbnail preview.' },
  ];
}
