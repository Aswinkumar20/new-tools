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

const HISTORY_KEY = 'websocket-client-url-history';

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
  private connectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly form: WebSocketClientFormGroup = this.fb.group({
    url: this.fb.control('wss://echo.websocket.events', {
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
  readonly urlHistory = signal<string[]>([]);
  private websocket: WebSocket | null = null;

  readonly hasMessages = computed(() => this.messages().length > 0);
  readonly isConnected = computed(() => this.connectionStatus() === 'connected');
  readonly isConnecting = computed(() => this.connectionStatus() === 'connecting');
  readonly hasError = computed(() => this.connectionStatus() === 'error');

  constructor() {
    this.loadUrlHistory();
  }

  ngOnDestroy(): void {
    this.clearConnectTimeout();
    this.disconnect();
  }

  connect(): void {
    this.errors.set([]);
    this.warnings.set([]);

    const url = this.form.controls.url.value.trim();

    if (!url || !this.form.controls.url.valid) {
      this.errors.set(['Please enter a valid WebSocket URL starting with ws:// or wss://']);
      return;
    }

    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.warnings.set(['Already connected. Disconnect first to connect to a different server.']);
      return;
    }

    this.disconnect();
    this.connectionStatus.set('connecting');
    this.addSystemMessage('Connecting to ' + url + '...');

    try {
      this.websocket = new WebSocket(url);

      this.connectTimeoutId = setTimeout(() => {
        if (this.connectionStatus() === 'connecting') {
          this.errors.set(['Connection timed out after 10 seconds.']);
          this.addSystemMessage('Connection timed out');
          this.websocket?.close();
          this.connectionStatus.set('error');
          this.websocket = null;
        }
      }, 10000);

      this.websocket.onopen = () => {
        this.clearConnectTimeout();
        this.connectionStatus.set('connected');
        this.addSystemMessage('Connected successfully');
        this.persistUrl(url);
      };

      this.websocket.onmessage = (event) => {
        void this.handleIncomingMessage(event.data);
      };

      this.websocket.onerror = () => {
        this.clearConnectTimeout();
        this.connectionStatus.set('error');
        this.errors.set(['WebSocket error occurred. The server may be unreachable or blocked.']);
        this.addSystemMessage('Connection error');
      };

      this.websocket.onclose = (event) => {
        this.clearConnectTimeout();
        if (this.connectionStatus() !== 'error') {
          this.connectionStatus.set('disconnected');
        }
        if (event.wasClean) {
          this.addSystemMessage(`Connection closed (code ${event.code})`);
        } else {
          this.addSystemMessage(`Connection closed unexpectedly (code ${event.code})`);
          this.warnings.set([`Connection was closed unexpectedly. Code: ${event.code}`]);
        }
        this.websocket = null;
      };
    } catch (error) {
      this.clearConnectTimeout();
      this.connectionStatus.set('error');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.errors.set([`Failed to connect: ${errorMessage}`]);
      this.addSystemMessage('Connection failed: ' + errorMessage);
      this.websocket = null;
    }
  }

  disconnect(): void {
    this.clearConnectTimeout();
    if (this.websocket) {
      this.websocket.onopen = null;
      this.websocket.onmessage = null;
      this.websocket.onerror = null;
      this.websocket.onclose = null;
      if (this.websocket.readyState === WebSocket.OPEN || this.websocket.readyState === WebSocket.CONNECTING) {
        this.websocket.close();
      }
      this.websocket = null;
    }
    if (this.connectionStatus() !== 'error') {
      this.connectionStatus.set('disconnected');
    }
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
        this.errors.set([]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        this.errors.set([`Failed to send message: ${errorMessage}`]);
      }
    } else {
      this.errors.set(['WebSocket is not open. Please reconnect.']);
    }
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  applyUrl(url: string): void {
    this.form.patchValue({ url });
  }

  clearMessages(): void {
    this.messages.set([]);
  }

  clearUrlHistory(): void {
    this.urlHistory.set([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
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

  private async handleIncomingMessage(data: unknown): Promise<void> {
    if (typeof data === 'string') {
      this.addMessage('received', data);
      return;
    }
    if (data instanceof Blob) {
      this.addMessage('received', await data.text());
      return;
    }
    if (data instanceof ArrayBuffer) {
      this.addMessage('received', new TextDecoder().decode(data));
      return;
    }
    this.addSystemMessage(`Unsupported message type: ${Object.prototype.toString.call(data)}`);
  }

  private addMessage(type: 'sent' | 'received' | 'system', content: string): void {
    const message: Message = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
      type,
      content,
      timestamp: Date.now()
    };

    this.messages.update((msgs) => [...msgs, message].slice(-100));
  }

  private addSystemMessage(content: string): void {
    this.addMessage('system', content);
  }

  private persistUrl(url: string): void {
    if (!this.form.controls.rememberHistory.value) {
      return;
    }
    this.urlHistory.update((entries) => {
      const next = [url, ...entries.filter((u) => u !== url)].slice(0, 10);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  private loadUrlHistory(): void {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        this.urlHistory.set(JSON.parse(stored) as string[]);
      }
    } catch {
      // ignore
    }
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeoutId != null) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  formatMessageContent(content: string): string {
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
