import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-markdown-to-pdf',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="markdown-to-pdf" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownToPdfComponent {}
