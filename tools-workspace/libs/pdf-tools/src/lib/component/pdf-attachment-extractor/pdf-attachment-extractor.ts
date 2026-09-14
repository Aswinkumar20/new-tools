import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-attachment-extractor',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-attachment-extractor" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfAttachmentExtractorComponent {}
