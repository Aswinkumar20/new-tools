import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-barcode-generator',
  standalone: true,
  templateUrl: './barcode-generator.html',
  styleUrls: ['./barcode-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class BarcodeGeneratorComponent {
  constructor() {}
}
