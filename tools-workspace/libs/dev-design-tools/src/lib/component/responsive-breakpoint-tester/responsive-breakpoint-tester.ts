import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-responsive-breakpoint-tester',
  standalone: true,
  templateUrl: './responsive-breakpoint-tester.html',
  styleUrls: ['./responsive-breakpoint-tester.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class ResponsiveBreakpointTesterComponent {
  constructor() {}
}
