import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-screenshot-to-pdf',
  standalone: true,
  templateUrl: './screenshot-to-pdf.html',
  styleUrls: ['./screenshot-to-pdf.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ScreenshotToPdfComponent {
  constructor() {}
}
