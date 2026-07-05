import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface Message {
  id: string;
  type: 'sent' | 'received' | 'system';
  content: string;
  timestamp: number;
}

type WebSocketClientFormGroup = FormGroup<{
  url: FormControl<string>;
  message: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

@Component({
  selector: 'lib-websocket-client',
  standalone: true,
  templateUrl: './websocket-client.html',
  styleUrls: ['./websocket-client.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebSocketClientComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly assetService = inject(AssetService);

  readonly form: WebSocketClientFormGroup = this.fb.group({
    url: this.fb.control('wss://echo.websocket.org', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^wss?:\/\/.+/)]
    }),
    message: this.fb.control('', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly messages = signal<Message[]>([]);
  readonly connectionStatus = signal<ConnectionStatus>('disconnected');
  private websocket: WebSocket | null = null;

  readonly hasMessages = computed(() => this.messages().length > 0);
  readonly isConnected = computed(() => this.connectionStatus() === 'connected');
  readonly isConnecting = computed(() => this.connectionStatus() === 'connecting');

  constructor() {
    // Cleanup is handled in ngOnDestroy
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  connect(): void {
    this.errors.set([]);
    this.warnings.set([]);

    const url = this.form.controls.url.value;

    if (!url || !this.form.controls.url.valid) {
      this.errors.set(['Please enter a valid WebSocket URL starting with ws:// or wss://']);
      return;
    }

    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.warnings.set(['Already connected. Disconnect first to connect to a different server.']);
      return;
    }

    this.connectionStatus.set('connecting');
    this.addSystemMessage('Connecting to ' + url + '...');

    try {
      this.websocket = new WebSocket(url);

      this.websocket.onopen = () => {
        this.connectionStatus.set('connected');
        this.addSystemMessage('Connected successfully');
      };

      this.websocket.onmessage = (event) => {
        this.addMessage('received', event.data);
      };

      this.websocket.onerror = (error) => {
        this.connectionStatus.set('error');
        this.errors.set(['WebSocket error occurred. Check the console for details.']);
        this.addSystemMessage('Connection error');
        console.error('WebSocket error:', error);
      };

      this.websocket.onclose = (event) => {
        this.connectionStatus.set('disconnected');
        if (event.wasClean) {
          this.addSystemMessage('Connection closed');
        } else {
          this.addSystemMessage('Connection closed unexpectedly');
          this.warnings.set(['Connection was closed unexpectedly. Code: ' + event.code]);
        }
        this.websocket = null;
      };
    } catch (error) {
      this.connectionStatus.set('error');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.errors.set([`Failed to connect: ${errorMessage}`]);
      this.addSystemMessage('Connection failed: ' + errorMessage);
      this.websocket = null;
    }
  }

  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.connectionStatus.set('disconnected');
  }

  sendMessage(): void {
    if (!this.isConnected()) {
      this.errors.set(['Not connected. Please connect to a WebSocket server first.']);
      return;
    }

    const message = this.form.controls.message.value.trim();

    if (!message) {
      this.errors.set(['Please enter a message to send.']);
      return;
    }

    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      try {
        this.websocket.send(message);
        this.addMessage('sent', message);
        this.form.controls.message.setValue('');

        if (this.form.controls.rememberHistory.value) {
          // History is already tracked via messages
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        this.errors.set([`Failed to send message: ${errorMessage}`]);
      }
    } else {
      this.errors.set(['WebSocket is not open. Please reconnect.']);
    }
  }

  clearMessages(): void {
    this.messages.set([]);
  }

  copyToClipboard(text: string, label: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Success
      })
      .catch(() => {
        this.errors.set([`Unable to copy ${label} to clipboard.`]);
      });
  }

  private addMessage(type: 'sent' | 'received' | 'system', content: string): void {
    const message: Message = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
      type,
      content,
      timestamp: Date.now()
    };

    this.messages.update((msgs) => [...msgs, message].slice(-100)); // Keep last 100 messages
  }

  private addSystemMessage(content: string): void {
    this.addMessage('system', content);
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  formatMessageContent(content: string): string {
    // Try to format as JSON if possible
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  isJson(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }
}
