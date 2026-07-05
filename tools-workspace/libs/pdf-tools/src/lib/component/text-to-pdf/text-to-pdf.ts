import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-text-to-pdf',
  standalone: true,
  templateUrl: './text-to-pdf.html',
  styleUrls: ['./text-to-pdf.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextToPdfComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Text to PDF';
  readonly description = 'Convert plain text or Markdown into a formatted PDF with page size, margins, and font controls.';
  readonly uploadLabel = 'Text or document upload';
  readonly uploadHint = 'Paste text or upload .txt / .md files — up to 10 MB per file.';
  readonly acceptHint = 'TXT, MD';

  readonly features: readonly string[] = [
    'Live preview with page breaks and headers/footers',
    'A4, Letter, and Legal page sizes with custom margins',
    'Monospace or serif font selection with adjustable size',
    'Optional title page and automatic page numbering',
  ];

  readonly helpItems: readonly string[] = [
    'Paste or type content in the editor — PDF generates as you adjust options.',
    'Choose page size and orientation before export.',
    'Download runs entirely in your browser; nothing is uploaded.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Processing will run <strong>locally</strong> in your browser.' },
    { accent: false, text: 'Supports UTF-8 text and basic Markdown headings.' },
  ];
}
