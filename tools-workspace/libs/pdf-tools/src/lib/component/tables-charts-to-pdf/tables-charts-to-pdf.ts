import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-tables-charts-to-pdf',
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
export class TablesChartsToPdfComponent {
  readonly mode: PdfToolMode = 'tables-charts-to-pdf';
  readonly title = 'Tables & Charts to PDF';
  readonly description = 'Export tabular data into a printable PDF.';
}
