import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-html-entity-encoder',
  standalone: true,
  templateUrl: './html-entity-encoder.html',
  styleUrls: ['./html-entity-encoder.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class HtmlEntityEncoderComponent {
  constructor() {}
}
