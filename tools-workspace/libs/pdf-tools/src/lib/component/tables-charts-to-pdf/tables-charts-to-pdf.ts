import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-tables-charts-to-pdf',
  standalone: true,
  templateUrl: './tables-charts-to-pdf.html',
  styleUrls: ['./tables-charts-to-pdf.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablesChartsToPdfComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Tables & Charts to PDF';
  readonly description = 'Turn spreadsheet data, HTML tables, or chart images into print-ready PDF documents.';
  readonly uploadLabel = 'Data or image upload';
  readonly uploadHint = 'Drop CSV, Excel, HTML table exports, or chart PNG/SVG files.';
  readonly acceptHint = 'CSV, XLSX, HTML, PNG, SVG';

  readonly features: readonly string[] = [
    'Import CSV/Excel and render styled tables with pagination',
    'Paste HTML tables or embed chart screenshots',
    'Column width, header repeat, and landscape layout options',
    'Export single or multi-page PDF with optional cover sheet',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a data file or paste a table to preview the layout.',
    'Adjust column sizing and page breaks before export.',
    'Chart images are scaled to fit the selected page size.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'No server upload — tables are rendered client-side.' },
    { accent: false, text: 'Large datasets may be split across multiple PDF pages.' },
  ];
}
