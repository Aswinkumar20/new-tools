import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-multi-pdf-chat',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="multi-pdf-chat" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiPdfChatComponent {}
