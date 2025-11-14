import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-gradient-generator',
  standalone: true,
  templateUrl: './gradient-generator.html',
  styleUrls: ['./gradient-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class GradientGeneratorComponent {
  constructor() {}
}
