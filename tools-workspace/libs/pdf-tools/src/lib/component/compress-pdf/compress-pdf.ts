import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-compress-pdf',
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
export class CompressPdfComponent {
  readonly mode: PdfToolMode = 'compress-pdf';
  readonly title = 'Compress PDF';
  readonly description = 'Optimize PDF structure with object streams (basic in-browser compression).';
}
