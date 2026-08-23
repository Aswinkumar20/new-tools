import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-rotate-pages',
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
export class RotatePagesComponent {
  readonly mode: PdfToolMode = 'rotate-pages';
  readonly title = 'Rotate PDF Pages';
  readonly description = 'Rotate pages 90°, 180°, or 270° before exporting.';
}
