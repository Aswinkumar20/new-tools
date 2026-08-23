import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-annotate-pdf',
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
export class AnnotatePdfComponent {
  readonly mode: PdfToolMode = 'annotate-pdf';
  readonly title = 'Annotate PDF';
  readonly description = 'Add text annotations anywhere on PDF pages.';
}
