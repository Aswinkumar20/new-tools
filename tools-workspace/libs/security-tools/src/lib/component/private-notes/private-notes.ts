import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-private-notes',
  standalone: true,
  templateUrl: './private-notes.html',
  styleUrls: ['./private-notes.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class PrivateNotesComponent {
  constructor() {}
}
