import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-compress-pdf',
  standalone: true,
  templateUrl: './compress-pdf.html',
  styleUrls: ['./compress-pdf.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class CompressPdfComponent {
  constructor() {}
}
