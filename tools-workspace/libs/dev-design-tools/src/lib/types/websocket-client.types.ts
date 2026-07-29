export type WebSocketMessageType = 'sent' | 'received' | 'system';

export type WebSocketConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketLogMessage {
  id: string;
  type: WebSocketMessageType;
  content: string;
  timestamp: number;
}
