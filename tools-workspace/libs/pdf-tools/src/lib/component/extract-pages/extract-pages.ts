import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-extract-pages',
  standalone: true,
  templateUrl: './extract-pages.html',
  styleUrls: ['./extract-pages.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtractPagesComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Extract PDF Pages';
  readonly description = 'Pull specific pages or ranges from a PDF into a new document without re-scanning.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a PDF and specify pages to extract (e.g. 1-3, 7, 10-12).';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'Extract by page number, range, or comma-separated list',
    'Preview selected pages before export',
    'Output single PDF or separate files per range',
    'Optional ZIP download for multiple extracts',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF and enter page numbers or ranges.',
    'Preview the selection in the canvas area.',
    'Download the extracted pages as a new PDF.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Extraction uses pdf-lib — no server round-trip.' },
    { accent: false, text: 'Page numbers are 1-based and inclusive.' },
  ];
}
