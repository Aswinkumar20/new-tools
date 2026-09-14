import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-accessibility-tagger',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-accessibility-tagger" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfAccessibilityTaggerComponent {}
