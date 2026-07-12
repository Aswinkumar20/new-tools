import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfJspdfWorkbenchComponent } from '../pdf-jspdf-workbench/pdf-jspdf-workbench';
import type { PdfJspdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-tables-to-pdf',
  standalone: true,
  template: `
    <lib-pdf-jspdf-workbench [mode]="mode" [title]="title" [description]="description" />
  `,
  imports: [PdfJspdfWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablesToPdfComponent {
  readonly mode: PdfJspdfToolMode = 'tables-to-pdf';
  readonly title = 'Tables to PDF';
  readonly description = 'Build an editable table and export it as a formatted PDF document.';
}
