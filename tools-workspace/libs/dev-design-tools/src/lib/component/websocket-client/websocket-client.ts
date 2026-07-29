import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { ddCopyText } from '../../shared/dd-clipboard.util';
import type { DdRelatedToolLink } from '../../shared/dd-tool-suggestion.model';
import {
  WEBSOCKET_CONNECT_TIMEOUT_MS,
  WEBSOCKET_DEFAULT_URL,
  WEBSOCKET_RELATED_TOOLS,
  WEBSOCKET_URL_PATTERN
} from '../../constants/websocket-client.constants';
import type {
  WebSocketConnectionStatus,
  WebSocketLogMessage,
  WebSocketMessageType
} from '../../types/websocket-client.types';
import {
  appendLogMessage,
  clearUrlHistoryStorage,
  createLogMessage,
  decodeIncomingMessageData,
  formatConnectionStatusLabel,
  formatMessageContent,
  formatMessageTimestamp,
  isJsonContent,
  isValidWebSocketUrl,
  loadUrlHistoryFromStorage,
  persistUrlHistory,
  prependUrlHistory,
  resolveWebSocketSuggestion
} from '../../utils/websocket-client.utils';

type WebSocketClientFormGroup = FormGroup<{
  url: FormControl<string>;
  message: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-websocket-client',
  standalone: true,
  templateUrl: './websocket-client.html',
  styleUrls: ['./websocket-client.scss'],
  imports: [ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebSocketClientComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  private connectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private websocket: WebSocket | null = null;

  readonly form: WebSocketClientFormGroup = this.fb.group({
    url: this.fb.control(WEBSOCKET_DEFAULT_URL, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(WEBSOCKET_URL_PATTERN)]
    }),
    message: this.fb.control('', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly relatedTools: ReadonlyArray<DdRelatedToolLink> = WEBSOCKET_RELATED_TOOLS;
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly messages = signal<WebSocketLogMessage[]>([]);
  readonly connectionStatus = signal<WebSocketConnectionStatus>('disconnected');
  readonly urlHistory = signal<string[]>([]);
  private readonly hasCopiedMessage = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasMessages = computed(() => this.messages().length > 0);
  readonly isConnected = computed(() => this.connectionStatus() === 'connected');
  readonly isConnecting = computed(() => this.connectionStatus() === 'connecting');
  readonly hasError = computed(() => this.connectionStatus() === 'error');
  readonly statusLabel = computed(() => formatConnectionStatusLabel(this.connectionStatus()));
  readonly primarySuggestion = computed(() => {
    const suggestion = resolveWebSocketSuggestion({
      status: this.connectionStatus(),
      url: this.form.controls.url.value,
      messages: this.messages(),
      hasCopiedMessage: this.hasCopiedMessage(),
      hasUrlError: this.errors().some((message) => message.includes('WebSocket URL'))
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.urlHistory.set(loadUrlHistoryFromStorage());
  }

  ngOnDestroy(): void {
    this.clearConnectTimeout();
    this.disconnect();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  connect(): void {
    this.errors.set([]);
    this.warnings.set([]);
    this.hasCopiedMessage.set(false);
    this.dismissedSuggestionId.set(null);

    const url = this.form.controls.url.value.trim();

    if (!url || !this.form.controls.url.valid || !isValidWebSocketUrl(url)) {
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
      }, WEBSOCKET_CONNECT_TIMEOUT_MS);

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
      if (
        this.websocket.readyState === WebSocket.OPEN ||
        this.websocket.readyState === WebSocket.CONNECTING
      ) {
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
    this.dismissedSuggestionId.set(null);
  }

  clearMessages(): void {
    this.messages.set([]);
    this.hasCopiedMessage.set(false);
    this.dismissedSuggestionId.set(null);
  }

  clearUrlHistory(): void {
    this.urlHistory.set([]);
    clearUrlHistoryStorage();
  }

  async copyToClipboard(text: string, label: string): Promise<void> {
    const ok = await ddCopyText(this.toast, text, label);
    if (ok) {
      this.hasCopiedMessage.set(true);
      this.dismissedSuggestionId.set(null);
      this.errors.set([]);
    } else {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  formatTimestamp(timestamp: number): string {
    return formatMessageTimestamp(timestamp);
  }

  formatJsonContent(content: string): string {
    return formatMessageContent(content);
  }

  isJson(content: string): boolean {
    return isJsonContent(content);
  }

  private async handleIncomingMessage(data: unknown): Promise<void> {
    const decoded = await decodeIncomingMessageData(data);
    if (decoded.kind === 'text') {
      this.addMessage('received', decoded.content);
      return;
    }
    this.addSystemMessage(decoded.content);
  }

  private addMessage(type: WebSocketMessageType, content: string): void {
    const message = createLogMessage(type, content);
    this.messages.update((msgs) => appendLogMessage(msgs, message));
  }

  private addSystemMessage(content: string): void {
    this.addMessage('system', content);
  }

  private persistUrl(url: string): void {
    if (!this.form.controls.rememberHistory.value) {
      return;
    }
    this.urlHistory.update((entries) => {
      const next = prependUrlHistory(entries, url);
      persistUrlHistory(next);
      return next;
    });
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeoutId != null) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
  }
}
