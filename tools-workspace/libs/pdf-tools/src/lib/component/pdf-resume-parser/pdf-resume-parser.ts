import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-resume-parser',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-resume-parser" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfResumeParserComponent {}
