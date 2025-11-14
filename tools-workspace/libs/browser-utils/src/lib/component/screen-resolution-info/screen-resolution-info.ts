import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-screen-resolution-info',
  standalone: true,
  templateUrl: './screen-resolution-info.html',
  styleUrls: ['./screen-resolution-info.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ScreenResolutionInfoComponent {
  constructor() {}
}
