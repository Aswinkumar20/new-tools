import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-data-extractor',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-data-extractor" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfDataExtractorComponent {}
