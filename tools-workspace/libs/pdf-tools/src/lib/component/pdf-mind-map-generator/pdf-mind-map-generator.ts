import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-mind-map-generator',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-mind-map-generator" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfMindMapGeneratorComponent {}
