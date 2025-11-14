import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-timezone-converter',
  standalone: true,
  templateUrl: './timezone-converter.html',
  styleUrls: ['./timezone-converter.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class TimezoneConverterComponent {
  constructor() {}
}
