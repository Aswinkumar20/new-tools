import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-jwt-decoder',
  standalone: true,
  templateUrl: './jwt-decoder.html',
  styleUrls: ['./jwt-decoder.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class JwtDecoderComponent {
  constructor() {}
}
