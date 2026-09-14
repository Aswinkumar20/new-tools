import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-page-resizer',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-page-resizer" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfPageResizerComponent {}
