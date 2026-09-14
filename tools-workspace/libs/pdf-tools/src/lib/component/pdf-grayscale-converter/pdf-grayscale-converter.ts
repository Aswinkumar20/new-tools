import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-grayscale-converter',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-grayscale-converter" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfGrayscaleConverterComponent {}
