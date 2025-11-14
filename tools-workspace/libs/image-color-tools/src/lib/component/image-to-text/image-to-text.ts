import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-image-to-text',
  standalone: true,
  templateUrl: './image-to-text.html',
  styleUrls: ['./image-to-text.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ImageToTextComponent {
  constructor() {}
}
