import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-user-agent-parser',
  standalone: true,
  templateUrl: './user-agent-parser.html',
  styleUrls: ['./user-agent-parser.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class UserAgentParserComponent {
  constructor() {}
}
