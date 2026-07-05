import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-resume-invoice-generator',
  standalone: true,
  templateUrl: './resume-invoice-generator.html',
  styleUrls: ['./resume-invoice-generator.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumeInvoiceGeneratorComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Resume & Invoice Generator';
  readonly description = 'Fill structured templates to generate professional resume or invoice PDFs in minutes.';
  readonly uploadLabel = 'Template & logo upload';
  readonly uploadHint = 'Optional logo/photo upload will be enabled — PDF output from form fields.';
  readonly acceptHint = 'PNG, JPG (logo)';

  readonly features: readonly string[] = [
    'Resume templates with sections for experience, skills, and education',
    'Invoice layouts with line items, tax, and payment terms',
    'Custom accent color and font pairing',
    'Instant PDF preview and download',
  ];

  readonly helpItems: readonly string[] = [
    'Pick a template type (resume or invoice) and fill the form fields.',
    'Upload an optional logo or profile photo.',
    'Export a polished PDF ready to share or print.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: false, text: 'Templates stay editable until you export the final PDF.' },
    { accent: true, text: 'All generation happens <strong>offline</strong> in the browser.' },
  ];
}
