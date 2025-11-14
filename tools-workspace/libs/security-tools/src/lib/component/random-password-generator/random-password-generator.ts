import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-random-password-generator',
  standalone: true,
  templateUrl: './random-password-generator.html',
  styleUrls: ['./random-password-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class RandomPasswordGeneratorComponent {
  constructor() {}
}
