import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-reading-order-fixer',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-reading-order-fixer" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfReadingOrderFixerComponent {}
