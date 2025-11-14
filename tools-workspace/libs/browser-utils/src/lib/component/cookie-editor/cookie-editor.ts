import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-cookie-editor',
  standalone: true,
  templateUrl: './cookie-editor.html',
  styleUrls: ['./cookie-editor.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class CookieEditorComponent {
  constructor() {}
}
