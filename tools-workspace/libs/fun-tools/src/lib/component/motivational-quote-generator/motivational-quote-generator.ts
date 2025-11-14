import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-motivational-quote-generator',
  standalone: true,
  templateUrl: './motivational-quote-generator.html',
  styleUrls: ['./motivational-quote-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class MotivationalQuoteGeneratorComponent {
  constructor() {}
}
