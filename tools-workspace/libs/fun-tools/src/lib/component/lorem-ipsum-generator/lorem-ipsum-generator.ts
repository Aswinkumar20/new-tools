import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-lorem-ipsum-generator',
  standalone: true,
  templateUrl: './lorem-ipsum-generator.html',
  styleUrls: ['./lorem-ipsum-generator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class LoremIpsumGeneratorComponent {
  constructor() {}
}
