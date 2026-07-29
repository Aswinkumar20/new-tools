import {
  appendLogMessage,
  createLogMessage,
  decodeIncomingMessageData,
  formatConnectionStatusLabel,
  formatMessageContent,
  isJsonContent,
  isValidWebSocketUrl,
  looksLikeInsecureWsOnHttps,
  prependUrlHistory,
  resolveWebSocketSuggestion
} from './websocket-client.utils';
import { WEBSOCKET_URL_PATTERN } from '../constants/websocket-client.constants';
import type { WebSocketLogMessage } from '../types/websocket-client.types';

describe('websocket-client utils', () => {
  it('validates websocket URLs', () => {
    expect(isValidWebSocketUrl('wss://echo.websocket.events')).toBe(true);
    expect(isValidWebSocketUrl('ws://localhost:8080')).toBe(true);
    expect(isValidWebSocketUrl('https://example.com')).toBe(false);
    expect(WEBSOCKET_URL_PATTERN.test('wss://a.test')).toBe(true);
  });

  it('formats status labels and JSON content', () => {
    expect(formatConnectionStatusLabel('connected')).toBe('Connected');
    expect(formatConnectionStatusLabel('error')).toBe('Error');
    expect(isJsonContent('{"a":1}')).toBe(true);
    expect(isJsonContent('plain')).toBe(false);
    expect(formatMessageContent('{"a":1}')).toContain('"a": 1');
  });

  it('creates and appends log messages with a limit', () => {
    const message = createLogMessage('sent', 'hi', 1000, 'abc');
    expect(message.id).toBe('1000abc');
    expect(appendLogMessage([], message, 2)).toHaveLength(1);
    const second = createLogMessage('received', 'yo', 1001, 'def');
    const third = createLogMessage('system', 'ok', 1002, 'ghi');
    expect(appendLogMessage([message, second], third, 2)).toEqual([second, third]);
  });

  it('prepends unique URL history', () => {
    expect(prependUrlHistory(['wss://a', 'wss://b'], 'wss://b')).toEqual(['wss://b', 'wss://a']);
  });

  it('decodes incoming message payloads', async () => {
    expect(await decodeIncomingMessageData('hello')).toEqual({ kind: 'text', content: 'hello' });
    const bytes = new Uint8Array([98, 105, 110]);
    expect(await decodeIncomingMessageData(bytes.buffer)).toEqual({
      kind: 'text',
      content: 'bin'
    });
    expect((await decodeIncomingMessageData(123)).kind).toBe('unsupported');
  });

  it('resolves contextual suggestions', () => {
    const jsonMsg: WebSocketLogMessage = {
      id: '1',
      type: 'received',
      content: '{"ok":true}',
      timestamp: 1
    };

    expect(
      resolveWebSocketSuggestion({
        status: 'error',
        url: 'wss://echo.websocket.events',
        messages: [],
        hasCopiedMessage: false,
        hasUrlError: false
      })?.id
    ).toBe('wsc-http-fallback');

    expect(
      resolveWebSocketSuggestion({
        status: 'connected',
        url: 'wss://echo.websocket.events',
        messages: [jsonMsg],
        hasCopiedMessage: false,
        hasUrlError: false
      })?.id
    ).toBe('wsc-json-rx');

    expect(
      resolveWebSocketSuggestion({
        status: 'disconnected',
        url: 'wss://echo.websocket.events',
        messages: [],
        hasCopiedMessage: false,
        hasUrlError: false
      })?.id
    ).toBe('wsc-rest');

    expect(typeof looksLikeInsecureWsOnHttps('ws://localhost')).toBe('boolean');
  });
});
