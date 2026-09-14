import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfAdvancedWorkbenchComponent } from '../pdf-advanced-workbench/pdf-advanced-workbench';

@Component({
  selector: 'lib-pdf-bookmark-creator',
  standalone: true,
  template: `
    <lib-pdf-advanced-workbench toolId="pdf-bookmark-creator" />
  `,
  imports: [PdfAdvancedWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfBookmarkCreatorComponent {}
