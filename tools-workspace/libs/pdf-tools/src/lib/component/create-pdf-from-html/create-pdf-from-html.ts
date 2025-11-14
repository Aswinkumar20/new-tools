import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-create-pdf-from-html',
  standalone: true,
  templateUrl: './create-pdf-from-html.html',
  styleUrls: ['./create-pdf-from-html.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class CreatePdfFromHtmlComponent {
  constructor() {}
}
