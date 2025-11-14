import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-css-minifier',
  standalone: true,
  templateUrl: './css-minifier.html',
  styleUrls: ['./css-minifier.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class CssMinifierComponent {
  constructor() {}
}
