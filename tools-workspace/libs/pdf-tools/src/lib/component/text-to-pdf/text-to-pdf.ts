import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-text-to-pdf',
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
export class TextToPdfComponent {
  readonly mode: PdfToolMode = 'text-to-pdf';
  readonly title = 'Text to PDF';
  readonly description =
    'Convert plain text into a formatted PDF — processed on the secure server when available, with a local fallback.';
}
