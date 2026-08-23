import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-flatten-pdf-forms',
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
export class FlattenPdfFormsComponent {
  readonly mode: PdfToolMode = 'flatten-pdf-forms';
  readonly title = 'Flatten PDF Forms';
  readonly description = 'Convert fillable forms into static, non-editable PDFs.';
}
