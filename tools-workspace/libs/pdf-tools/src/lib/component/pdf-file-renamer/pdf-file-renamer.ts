import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-file-renamer',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-file-renamer" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfFileRenamerComponent {}
