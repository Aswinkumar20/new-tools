import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-pdf-metadata-editor',
  standalone: true,
  templateUrl: './pdf-metadata-editor.html',
  styleUrls: ['./pdf-metadata-editor.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PdfMetadataEditorComponent {
  constructor() {}
}
