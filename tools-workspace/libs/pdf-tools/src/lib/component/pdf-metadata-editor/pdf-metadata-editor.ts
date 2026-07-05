import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-pdf-metadata-editor',
  standalone: true,
  templateUrl: './pdf-metadata-editor.html',
  styleUrls: ['./pdf-metadata-editor.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfMetadataEditorComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'PDF Metadata Editor';
  readonly description = 'View and edit document properties — title, author, subject, keywords, and creation date.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a PDF to inspect and edit its metadata fields.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'Read existing title, author, subject, and keywords',
    'Edit and write updated metadata back to the PDF',
    'View creation and modification timestamps',
    'Batch-apply defaults across multiple files',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF to load its current metadata.',
    'Edit fields in the sidebar form.',
    'Download the PDF with updated properties.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Metadata is rewritten locally with pdf-lib.' },
    { accent: false, text: 'Some viewers cache old metadata until the file is reopened.' },
  ];
}
