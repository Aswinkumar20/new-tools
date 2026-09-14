import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-powerpoint-to-pdf',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="powerpoint-to-pdf" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PowerpointToPdfComponent {}
