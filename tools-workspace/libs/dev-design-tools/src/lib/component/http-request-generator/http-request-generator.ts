import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-http-request-generator',
  standalone: true,
  templateUrl: './http-request-generator.html',
  styleUrls: ['./http-request-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class HttpRequestGeneratorComponent {
  constructor() {}
}
