import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-accessibility-checker',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-accessibility-checker" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfAccessibilityCheckerComponent {}
