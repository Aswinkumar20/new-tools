import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-pdf-to-base64',
  standalone: true,
  templateUrl: './pdf-to-base64.html',
  styleUrls: ['./pdf-to-base64.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PdfToBase64Component {
  constructor() {}
}
