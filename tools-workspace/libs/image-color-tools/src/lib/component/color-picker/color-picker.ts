import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-color-picker',
  standalone: true,
  templateUrl: './color-picker.html',
  styleUrls: ['./color-picker.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ColorPickerComponent {
  constructor() {}
}
