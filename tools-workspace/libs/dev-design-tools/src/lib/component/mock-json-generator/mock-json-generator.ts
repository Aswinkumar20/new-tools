import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-mock-json-generator',
  standalone: true,
  templateUrl: './mock-json-generator.html',
  styleUrls: ['./mock-json-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class MockJsonGeneratorComponent {
  constructor() {}
}
