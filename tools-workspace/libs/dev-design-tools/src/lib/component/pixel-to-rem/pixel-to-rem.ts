import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-pixel-to-rem',
  standalone: true,
  templateUrl: './pixel-to-rem.html',
  styleUrls: ['./pixel-to-rem.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PixelToRemComponent {
  constructor() {}
}
