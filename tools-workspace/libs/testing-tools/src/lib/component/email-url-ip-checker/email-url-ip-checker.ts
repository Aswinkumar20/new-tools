import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-email-url-ip-checker',
  standalone: true,
  templateUrl: './email-url-ip-checker.html',
  styleUrls: ['./email-url-ip-checker.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class EmailUrlIpCheckerComponent {
  constructor() {}
}
