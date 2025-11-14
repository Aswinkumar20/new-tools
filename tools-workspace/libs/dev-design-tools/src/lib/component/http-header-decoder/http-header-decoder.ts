import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-http-header-decoder',
  standalone: true,
  templateUrl: './http-header-decoder.html',
  styleUrls: ['./http-header-decoder.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class HttpHeaderDecoderComponent {
  constructor() {}
}
