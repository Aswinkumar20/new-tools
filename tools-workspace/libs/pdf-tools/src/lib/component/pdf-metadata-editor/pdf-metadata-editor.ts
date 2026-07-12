import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-pdf-metadata-editor',
  standalone: true,
  template: `
    <lib-pdf-workbench
      [mode]="mode"
      [title]="title"
      [description]="description" />
  `,
  imports: [PdfWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfMetadataEditorComponent {
  readonly mode: PdfToolMode = 'pdf-metadata-editor';
  readonly title = 'PDF Metadata Editor';
  readonly description = 'Read and update title, author, subject, and keywords.';
}
