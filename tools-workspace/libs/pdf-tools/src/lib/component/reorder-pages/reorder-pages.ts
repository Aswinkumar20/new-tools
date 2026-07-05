import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-reorder-pages',
  standalone: true,
  templateUrl: './reorder-pages.html',
  styleUrls: ['./reorder-pages.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReorderPagesComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Reorder PDF Pages';
  readonly description = 'Drag and drop page thumbnails to rearrange, duplicate, or delete pages in a PDF.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a PDF to open the page thumbnail grid.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'Drag-and-drop page thumbnail reordering',
    'Multi-select to move or delete page groups',
    'Duplicate pages for repeated content',
    'Export reordered PDF with one click',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF to load page thumbnails.',
    'Drag pages into the desired order.',
    'Export when the sequence is correct.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Page manipulation runs entirely <strong>client-side</strong>.' },
    { accent: false, text: 'Large documents may take a moment to render thumbnails.' },
  ];
}
