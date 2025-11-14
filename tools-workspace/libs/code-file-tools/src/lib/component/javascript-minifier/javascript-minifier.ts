import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-javascript-minifier',
  standalone: true,
  templateUrl: './javascript-minifier.html',
  styleUrls: ['./javascript-minifier.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class JavascriptMinifierComponent {
  constructor() {}
}
