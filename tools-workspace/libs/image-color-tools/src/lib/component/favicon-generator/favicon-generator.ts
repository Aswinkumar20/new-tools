import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-favicon-generator',
  standalone: true,
  templateUrl: './favicon-generator.html',
  styleUrls: ['./favicon-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class FaviconGeneratorComponent {
  constructor() {}
}
