import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-text-to-pdf',
  standalone: true,
  templateUrl: './text-to-pdf.html',
  styleUrls: ['./text-to-pdf.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class TextToPdfComponent {
  constructor() {}
}
