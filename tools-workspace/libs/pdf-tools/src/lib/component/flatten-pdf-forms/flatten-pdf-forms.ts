import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-flatten-pdf-forms',
  standalone: true,
  templateUrl: './flatten-pdf-forms.html',
  styleUrls: ['./flatten-pdf-forms.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlattenPdfFormsComponent {
  readonly assetService = inject(AssetService);

  readonly title = 'Flatten PDF Forms';
  readonly description = 'Convert interactive form fields into static content so values cannot be changed after submission.';
  readonly uploadLabel = 'PDF upload';
  readonly uploadHint = 'Drop a filled PDF form to flatten field values.';
  readonly acceptHint = 'PDF';

  readonly features: readonly string[] = [
    'Flatten all fields or selected pages only',
    'Preserve field appearance and values',
    'Remove interactivity while keeping visual layout',
    'Batch flatten multiple forms',
  ];

  readonly helpItems: readonly string[] = [
    'Upload a PDF with filled form fields.',
    'Preview which fields will be flattened.',
    'Download the static PDF for archival or sharing.',
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
    { accent: true, text: 'Flattening is irreversible — keep a copy of the original.' },
    { accent: false, text: 'Useful before emailing completed forms.' },
  ];
}
