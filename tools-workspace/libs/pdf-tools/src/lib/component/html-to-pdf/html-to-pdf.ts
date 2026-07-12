import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfJspdfWorkbenchComponent } from '../pdf-jspdf-workbench/pdf-jspdf-workbench';
import type { PdfJspdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-html-to-pdf',
  standalone: true,
  template: `
    <lib-pdf-jspdf-workbench [mode]="mode" [title]="title" [description]="description" />
  `,
  imports: [PdfJspdfWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HtmlToPdfComponent {
  readonly mode: PdfJspdfToolMode = 'html-to-pdf';
  readonly title = 'HTML to PDF';
  readonly description = 'Render HTML with styles and export a print-ready PDF using jsPDF and html2canvas.';
}
