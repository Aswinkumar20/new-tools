import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-pdf-viewer',
  standalone: true,
  templateUrl: './pdf-viewer.html',
  styleUrls: ['./pdf-viewer.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PdfViewerComponent {
  constructor() {}
}
