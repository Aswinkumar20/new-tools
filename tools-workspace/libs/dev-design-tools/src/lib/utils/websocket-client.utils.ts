import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import {
  WEBSOCKET_MESSAGE_LIMIT,
  WEBSOCKET_URL_HISTORY_KEY,
  WEBSOCKET_URL_HISTORY_LIMIT,
  WEBSOCKET_URL_PATTERN
} from '../constants/websocket-client.constants';
import type {
  WebSocketConnectionStatus,
  WebSocketLogMessage,
  WebSocketMessageType
} from '../types/websocket-client.types';

export function isValidWebSocketUrl(url: string): boolean {
  return WEBSOCKET_URL_PATTERN.test(url.trim());
}

export function formatConnectionStatusLabel(status: WebSocketConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'error':
      return 'Error';
    default:
      return 'Disconnected';
  }
}

export function createLogMessage(
  type: WebSocketMessageType,
  content: string,
  now = Date.now(),
  randomSuffix = Math.random().toString(36).substring(2, 11)
): WebSocketLogMessage {
  return {
    id: `${now}${randomSuffix}`,
    type,
    content,
    timestamp: now
  };
}

export function appendLogMessage(
  messages: WebSocketLogMessage[],
  message: WebSocketLogMessage,
  limit = WEBSOCKET_MESSAGE_LIMIT
): WebSocketLogMessage[] {
  return [...messages, message].slice(-limit);
}

export function isJsonContent(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

export function formatMessageContent(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

export function formatMessageTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function prependUrlHistory(
  entries: string[],
  url: string,
  limit = WEBSOCKET_URL_HISTORY_LIMIT
): string[] {
  return [url, ...entries.filter((existing) => existing !== url)].slice(0, limit);
}

export function loadUrlHistoryFromStorage(
  storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null
): string[] {
  if (!storage) {
    return [];
  }
  try {
    const stored = storage.getItem(WEBSOCKET_URL_HISTORY_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as string[];
  } catch {
    return [];
  }
}

export function persistUrlHistory(
  urls: ReadonlyArray<string>,
  storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(WEBSOCKET_URL_HISTORY_KEY, JSON.stringify(urls));
  } catch {
    // Ignore quota / privacy mode errors
  }
}

export function clearUrlHistoryStorage(
  storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null
): void {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(WEBSOCKET_URL_HISTORY_KEY);
  } catch {
    // Ignore
  }
}

export async function decodeIncomingMessageData(data: unknown): Promise<{
  kind: 'text' | 'unsupported';
  content: string;
}> {
  if (typeof data === 'string') {
    return { kind: 'text', content: data };
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return { kind: 'text', content: await data.text() };
  }
  if (isArrayBufferLike(data)) {
    return { kind: 'text', content: new TextDecoder().decode(data) };
  }
  return {
    kind: 'unsupported',
    content: `Unsupported message type: ${Object.prototype.toString.call(data)}`
  };
}

function isArrayBufferLike(data: unknown): data is ArrayBuffer {
  return (
    typeof ArrayBuffer !== 'undefined' &&
    (data instanceof ArrayBuffer || Object.prototype.toString.call(data) === '[object ArrayBuffer]')
  );
}

export function looksLikeInsecureWsOnHttps(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (!trimmed.startsWith('ws://')) {
    return false;
  }
  if (typeof location === 'undefined') {
    return false;
  }
  return location.protocol === 'https:';
}

export function resolveWebSocketSuggestion(options: {
  status: WebSocketConnectionStatus;
  url: string;
  messages: ReadonlyArray<WebSocketLogMessage>;
  hasCopiedMessage: boolean;
  hasUrlError: boolean;
}): DdToolSuggestion | null {
  const { status, url, messages, hasCopiedMessage, hasUrlError } = options;

  if (hasUrlError) {
    return null;
  }

  if (looksLikeInsecureWsOnHttps(url)) {
    return {
      id: 'wsc-mixed',
      title: 'Use a secure wss:// URL?',
      reason:
        'This page is HTTPS. Browsers often block insecure ws:// sockets as mixed content. Switch to wss:// for a reliable connection.',
      actionLabel: 'Open CORS Test Tool',
      path: '/dev-design-tools/cors-test-tool'
    };
  }

  if (hasCopiedMessage) {
    const latestCopiedCandidate = [...messages].reverse().find((msg) => msg.type !== 'system');
    if (latestCopiedCandidate && isJsonContent(latestCopiedCandidate.content)) {
      return {
        id: 'wsc-json-copy',
        title: 'Validate the copied JSON?',
        reason: 'The message looks like JSON. Beautify and lint it without leaving your workflow.',
        actionLabel: 'Open JSON Formatter',
        path: '/data-converters/json-formatter-beautifier-validator'
      };
    }
  }

  if (status === 'error') {
    return {
      id: 'wsc-http-fallback',
      title: 'Try the same API over HTTP?',
      reason:
        'Socket connect failed. Many backends expose a REST twin you can probe with Postman Lite while the websocket is down.',
      actionLabel: 'Open Postman Lite',
      path: '/dev-design-tools/postman-lite'
    };
  }

  const receivedJson = messages.some(
    (msg) => msg.type === 'received' && isJsonContent(msg.content)
  );
  if (receivedJson) {
    return {
      id: 'wsc-json-rx',
      title: 'Pretty-print received JSON?',
      reason: 'A received payload looks like JSON. Validate structure before wiring it into your client.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (status === 'connected') {
    return {
      id: 'wsc-codegen',
      title: 'Generate a reusable client snippet?',
      reason: 'The socket is open. Capture a matching HTTP/fetch snippet for environments without websockets.',
      actionLabel: 'Open HTTP Request Generator',
      path: '/dev-design-tools/http-request-generator'
    };
  }

  if (status === 'disconnected' && isValidWebSocketUrl(url)) {
    return {
      id: 'wsc-rest',
      title: 'Need REST instead of realtime?',
      reason: 'If the server also exposes HTTP endpoints, Postman Lite can verify auth and payloads first.',
      actionLabel: 'Open Postman Lite',
      path: '/dev-design-tools/postman-lite'
    };
  }

  return null;
}
