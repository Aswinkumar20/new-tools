import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-sensitive-data-scanner',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-sensitive-data-scanner" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfSensitiveDataScannerComponent {}
