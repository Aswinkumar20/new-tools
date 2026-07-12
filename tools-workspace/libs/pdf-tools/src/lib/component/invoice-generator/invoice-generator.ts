import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfJspdfWorkbenchComponent } from '../pdf-jspdf-workbench/pdf-jspdf-workbench';
import type { PdfJspdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-invoice-generator',
  standalone: true,
  template: `
    <lib-pdf-jspdf-workbench [mode]="mode" [title]="title" [description]="description" />
  `,
  imports: [PdfJspdfWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceGeneratorComponent {
  readonly mode: PdfJspdfToolMode = 'invoice-generator';
  readonly title = 'Invoice Generator';
  readonly description = 'Create professional invoices with line items, tax, and totals.';
}
