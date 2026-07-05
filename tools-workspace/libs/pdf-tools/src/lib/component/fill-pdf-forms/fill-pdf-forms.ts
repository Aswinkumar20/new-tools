import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-fill-pdf-forms',
  standalone: true,
  templateUrl: './fill-pdf-forms.html',
  styleUrls: ['./fill-pdf-forms.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FillPdfFormsComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Fill PDF Forms';
  readonly description = 'Detect AcroForm fields in PDFs and fill text boxes, checkboxes, and dropdowns in the browser.';
  readonly uploadLabel = 'PDF form upload';
  readonly uploadHint = 'Drop an interactive PDF form to detect and fill fields.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'Auto-detect text, checkbox, radio, and dropdown fields',
    'Tab through fields with keyboard navigation',
    'Save progress and export filled PDF',
    'Import/export field values as JSON',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF with AcroForm fields.',
    'Fill each field in the sidebar or overlay.',
    'Download the completed form as a new PDF.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Form data stays in your browser until you export.' },
    { accent: false, text: 'XFA-only forms may have limited support.' },
  ];
}
