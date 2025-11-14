import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-box-shadow-generator',
  standalone: true,
  templateUrl: './box-shadow-generator.html',
  styleUrls: ['./box-shadow-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class BoxShadowGeneratorComponent {
  constructor() {}
}
