import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfWorkbenchComponent } from '../pdf-workbench/pdf-workbench';
import type { PdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-image-to-pdf',
  standalone: true,
  template: `
    <lib-pdf-workbench [mode]="mode" [title]="title" [description]="description" />
  `,
  imports: [PdfWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageToPdfComponent {
  readonly mode: PdfToolMode = 'image-to-pdf';
  readonly title = 'Image to PDF';
  readonly description = 'Upload multiple images, reorder them, and export as a single PDF.';
}
