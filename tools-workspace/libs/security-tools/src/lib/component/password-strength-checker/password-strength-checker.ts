import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-password-strength-checker',
  standalone: true,
  templateUrl: './password-strength-checker.html',
  styleUrls: ['./password-strength-checker.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PasswordStrengthCheckerComponent {
  constructor() {}
}
