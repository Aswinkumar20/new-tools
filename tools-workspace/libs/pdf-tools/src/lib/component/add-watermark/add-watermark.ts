import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-add-watermark',
  standalone: true,
  templateUrl: './add-watermark.html',
  styleUrls: ['./add-watermark.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class AddWatermarkComponent {
  constructor() {}
}
