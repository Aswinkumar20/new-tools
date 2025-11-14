import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-border-radius-preview',
  standalone: true,
  templateUrl: './border-radius-preview.html',
  styleUrls: ['./border-radius-preview.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class BorderRadiusPreviewComponent {
  constructor() {}
}
