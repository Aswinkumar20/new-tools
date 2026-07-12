import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-add-page-numbers',
  standalone: true,
  template: `
    <lib-pdf-workbench [mode]="mode" [title]="title" [description]="description" />
  `,
  imports: [PdfWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPageNumbersComponent {
  readonly mode: PdfToolMode = 'add-page-numbers';
  readonly title = 'Add Page Numbers';
  readonly description = 'Stamp page numbers on every page with custom position, size, and format.';
}
