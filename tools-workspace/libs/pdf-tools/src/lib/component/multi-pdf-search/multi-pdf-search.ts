import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-multi-pdf-search',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="multi-pdf-search" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiPdfSearchComponent {}
