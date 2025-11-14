import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-qr-code-generator',
  standalone: true,
  templateUrl: './qr-code-generator.html',
  styleUrls: ['./qr-code-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class QrCodeGeneratorComponent {
  constructor() {}
}
