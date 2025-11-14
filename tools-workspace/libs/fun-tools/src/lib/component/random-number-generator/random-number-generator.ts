import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-random-number-generator',
  standalone: true,
  templateUrl: './random-number-generator.html',
  styleUrls: ['./random-number-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class RandomNumberGeneratorComponent {
  constructor() {}
}
