import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-uuid-generator',
  standalone: true,
  templateUrl: './uuid-generator.html',
  styleUrls: ['./uuid-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class UuidGeneratorComponent {
  constructor() {}
}
