import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-create-pdf-from-html',
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
export class CreatePdfFromHtmlComponent {
  readonly mode: PdfToolMode = 'create-pdf-from-html';
  readonly title = 'Create PDF from HTML';
  readonly description = 'Convert HTML content into a PDF (plain-text layout).';
}
