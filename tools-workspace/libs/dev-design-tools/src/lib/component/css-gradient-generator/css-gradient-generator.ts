import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-css-gradient-generator',
  standalone: true,
  templateUrl: './css-gradient-generator.html',
  styleUrls: ['./css-gradient-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class CssGradientGeneratorComponent {
  constructor() {}
}
