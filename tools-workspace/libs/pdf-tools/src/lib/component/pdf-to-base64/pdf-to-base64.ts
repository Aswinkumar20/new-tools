import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-pdf-to-base64',
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
export class PdfToBase64Component {
  readonly mode: PdfToolMode = 'pdf-to-base64';
  readonly title = 'PDF to Base64';
  readonly description = 'Encode PDFs into Base64 strings for APIs or embedding.';
}
