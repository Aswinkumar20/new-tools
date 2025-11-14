import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-markdown-to-pdf',
  standalone: true,
  templateUrl: './markdown-to-pdf.html',
  styleUrls: ['./markdown-to-pdf.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class MarkdownToPdfComponent {
  constructor() {}
}
