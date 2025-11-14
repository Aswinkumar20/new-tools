import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-palette-generator',
  standalone: true,
  templateUrl: './palette-generator.html',
  styleUrls: ['./palette-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PaletteGeneratorComponent {
  constructor() {}
}
