import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-password-rule-validator',
  standalone: true,
  templateUrl: './password-rule-validator.html',
  styleUrls: ['./password-rule-validator.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PasswordRuleValidatorComponent {
  constructor() {}
}
