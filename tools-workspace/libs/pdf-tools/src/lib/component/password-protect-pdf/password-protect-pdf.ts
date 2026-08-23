import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-password-protect-pdf',
  standalone: true,
  templateUrl: './password-protect-pdf.html',
  styleUrls: ['./password-protect-pdf.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PasswordProtectPdfComponent {
  constructor() {}
}
