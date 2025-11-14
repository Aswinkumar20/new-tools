import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-typing-speed-test',
  standalone: true,
  templateUrl: './typing-speed-test.html',
  styleUrls: ['./typing-speed-test.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class TypingSpeedTestComponent {
  constructor() {}
}
