import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-create-pdf-from-html',
  standalone: true,
  templateUrl: './create-pdf-from-html.html',
  styleUrls: ['./create-pdf-from-html.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePdfFromHtmlComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'HTML to PDF';
  readonly description = 'Render HTML and CSS into a PDF — paste markup or upload an .html file with print styles.';
  readonly uploadLabel = 'HTML upload';
  readonly uploadHint = 'Paste HTML or drop an .html file — CSS print rules supported.';
  readonly acceptHint = 'HTML, HTM';

  readonly features: readonly string[] = [
    'Live HTML/CSS preview before export',
    'Page size, margins, and header/footer templates',
    'Support for web fonts and background colors',
    'Multi-page automatic pagination',
  ];

  readonly helpItems: readonly string[] = [
    'Paste HTML or upload a file to preview rendering.',
    'Adjust page settings in the sidebar.',
    'Generate and download the PDF output.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Rendering uses browser print engine — stays local.' },
    { accent: false, text: 'Complex JavaScript-driven layouts may differ from browser view.' },
  ];
}
