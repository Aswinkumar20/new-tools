import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-html-to-pdf',
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
export class HtmlToPdfComponent {
  readonly mode: PdfToolMode = 'html-to-pdf';
  readonly title = 'HTML to PDF';
  readonly description =
    'Convert HTML into a print-ready PDF — uses the secure server renderer when available, with a local fallback.';
}
