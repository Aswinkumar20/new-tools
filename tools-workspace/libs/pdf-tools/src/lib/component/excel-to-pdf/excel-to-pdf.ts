import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-excel-to-pdf',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="excel-to-pdf" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExcelToPdfComponent {}
