import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-resume-invoice-generator',
  standalone: true,
  templateUrl: './resume-invoice-generator.html',
  styleUrls: ['./resume-invoice-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ResumeInvoiceGeneratorComponent {
  constructor() {}
}
