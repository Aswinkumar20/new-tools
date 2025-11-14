import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-hash-generator',
  standalone: true,
  templateUrl: './hash-generator.html',
  styleUrls: ['./hash-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class HashGeneratorComponent {
  constructor() {}
}
