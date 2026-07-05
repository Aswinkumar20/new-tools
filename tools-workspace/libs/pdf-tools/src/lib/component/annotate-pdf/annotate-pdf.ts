import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-annotate-pdf',
  standalone: true,
  templateUrl: './annotate-pdf.html',
  styleUrls: ['./annotate-pdf.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnotatePdfComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Annotate PDF';
  readonly description = 'Add notes, shapes, arrows, and freehand drawings on top of PDF pages for review and feedback.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a PDF to open the annotation canvas.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'Sticky notes, highlights, arrows, rectangles, and freehand pen',
    'Color and stroke width controls per tool',
    'Page-by-page annotation with undo/redo',
    'Export PDF with embedded annotations',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF and select an annotation tool.',
    'Draw or place markers on the current page.',
    'Download the annotated PDF for sharing.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Annotations export as standard PDF markup.' },
    { accent: false, text: 'Use zoom controls for precise placement on dense pages.' },
  ];
}
