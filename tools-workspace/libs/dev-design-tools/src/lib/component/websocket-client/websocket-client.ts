import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-websocket-client',
  standalone: true,
  templateUrl: './websocket-client.html',
  styleUrls: ['./websocket-client.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class WebsocketClientComponent {
  constructor() {}
}
