import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-screenshot-to-pdf',
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
export class ScreenshotToPdfComponent {
  readonly mode: PdfToolMode = 'screenshot-to-pdf';
  readonly title = 'Screenshot to PDF';
  readonly description = 'Turn images or screenshots into a multi-page PDF.';
}
