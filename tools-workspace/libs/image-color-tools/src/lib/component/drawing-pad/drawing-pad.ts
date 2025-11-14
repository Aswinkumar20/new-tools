import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-drawing-pad',
  standalone: true,
  templateUrl: './drawing-pad.html',
  styleUrls: ['./drawing-pad.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class DrawingPadComponent {
  constructor() {}
}
