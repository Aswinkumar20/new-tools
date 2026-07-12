import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfJspdfWorkbenchComponent } from '../pdf-jspdf-workbench/pdf-jspdf-workbench';
import type { PdfJspdfToolMode } from '../../shared/pdf.types';

@Component({
  selector: 'lib-resume-generator',
  standalone: true,
  template: `
    <lib-pdf-jspdf-workbench [mode]="mode" [title]="title" [description]="description" />
  `,
  imports: [PdfJspdfWorkbenchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumeGeneratorComponent {
  readonly mode: PdfJspdfToolMode = 'resume-generator';
  readonly title = 'Resume Generator';
  readonly description = 'Fill in resume sections and download a polished PDF resume.';
}
