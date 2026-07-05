import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-pdf-to-base64',
  standalone: true,
  templateUrl: './pdf-to-base64.html',
  styleUrls: ['./pdf-to-base64.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfToBase64Component {
  readonly assetService = inject(AssetService);

  readonly title = 'PDF to Base64';
  readonly description = 'Encode PDF files to Base64 strings for APIs, data URIs, or embedding in JSON payloads.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a PDF to encode — output copies to clipboard.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'One-click Base64 encoding with data-URI prefix option',
    'Copy to clipboard or download as .txt',
    'File size and character count stats',
    'Chunked output for large files',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF to generate its Base64 representation.',
    'Toggle data-URI prefix for use in HTML or CSS.',
    'Copy the encoded string to your clipboard.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Encoding happens locally — the PDF is not sent anywhere.' },
    { accent: false, text: 'Very large PDFs may produce long strings; use download instead of inline display.' },
  ];
}
