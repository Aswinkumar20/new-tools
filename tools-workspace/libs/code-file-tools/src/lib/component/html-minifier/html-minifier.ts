import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-html-minifier',
  standalone: true,
  templateUrl: './html-minifier.html',
  styleUrls: ['./html-minifier.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class HtmlMinifierComponent {
  constructor() {}
}
