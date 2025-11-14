import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-highlight-text',
  standalone: true,
  templateUrl: './highlight-text.html',
  styleUrls: ['./highlight-text.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class HighlightTextComponent {
  constructor() {}
}
