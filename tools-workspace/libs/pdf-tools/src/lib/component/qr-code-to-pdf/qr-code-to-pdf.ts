import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfJspdfWorkbenchComponent } from '../pdf-jspdf-workbench/pdf-jspdf-workbench';
import type { PdfJspdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-qr-code-to-pdf',
  standalone: true,
  template: `
    <lib-pdf-jspdf-workbench [mode]="mode" [title]="title" [description]="description" />
  `,
  imports: [PdfJspdfWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCodeToPdfComponent {
  readonly mode: PdfJspdfToolMode = 'qr-code-to-pdf';
  readonly title = 'QR Code to PDF';
  readonly description = 'Generate a QR code and insert it into a downloadable PDF.';
}
