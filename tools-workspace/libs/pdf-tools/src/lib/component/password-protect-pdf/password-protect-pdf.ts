import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-password-protect-pdf',
  standalone: true,
  templateUrl: './password-protect-pdf.html',
  styleUrls: ['./password-protect-pdf.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordProtectPdfComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Password Protect PDF';
  readonly description = 'Add open and permissions passwords to PDF files to restrict viewing, printing, or copying.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop an unencrypted PDF to apply password protection.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'User password (required to open) and owner password (permissions)',
    'Restrict printing, copying, and editing',
    'AES-128 encryption for broad compatibility',
    'Verify protection with built-in unlock test',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF and set open/owner passwords.',
    'Choose permission restrictions as needed.',
    'Download the encrypted PDF and test with the password.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Encryption runs in-browser; passwords are not stored.' },
    { accent: false, text: 'Keep your password safe — it cannot be recovered if lost.' },
  ];
}
