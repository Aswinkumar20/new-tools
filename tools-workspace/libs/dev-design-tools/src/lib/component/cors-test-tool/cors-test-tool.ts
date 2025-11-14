import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-cors-test-tool',
  standalone: true,
  templateUrl: './cors-test-tool.html',
  styleUrls: ['./cors-test-tool.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class CorsTestToolComponent {
  constructor() {}
}
