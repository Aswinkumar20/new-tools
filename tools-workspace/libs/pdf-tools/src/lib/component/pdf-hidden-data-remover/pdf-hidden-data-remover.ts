import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-hidden-data-remover',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-hidden-data-remover" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfHiddenDataRemoverComponent {}
