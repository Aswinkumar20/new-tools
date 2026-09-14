import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-images-to-searchable-pdf',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="images-to-searchable-pdf" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImagesToSearchablePdfComponent {}
