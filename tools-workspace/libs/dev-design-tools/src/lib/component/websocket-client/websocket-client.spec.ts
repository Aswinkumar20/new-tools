import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { WebSocketClientComponent } from './websocket-client';

describe('WebSocketClientComponent', () => {
  let component: WebSocketClientComponent;
  let fixture: ComponentFixture<WebSocketClientComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [WebSocketClientComponent],
      providers: [...ddToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(WebSocketClientComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create with defaults', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.url.value).toContain('wss://');
    expect(component.connectionStatus()).toBe('disconnected');
    expect(component.statusLabel()).toBe('Disconnected');
    expect(component.primarySuggestion()?.id).toBe('wsc-rest');
  });

  it('rejects invalid URLs before connecting', () => {
    component.form.controls.url.setValue('https://example.com');
    component.connect();
    expect(component.errors()[0]).toContain('ws:// or wss://');
    expect(component.connectionStatus()).toBe('disconnected');
  });

  it('blocks send when disconnected', () => {
    component.form.controls.message.setValue('hello');
    component.sendMessage();
    expect(component.errors()[0]).toContain('Not connected');
  });

  it('copies messages via toast clipboard helper', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    component['addMessage']('received', '{"ok":true}');
    await component.copyToClipboard('{"ok":true}', 'Message');
    expect(toast.info).toHaveBeenCalled();
    expect(component.primarySuggestion()?.id).toBe('wsc-json-copy');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion?.id).toBe('wsc-rest');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('clears messages and URL history', () => {
    component['addMessage']('system', 'hi');
    expect(component.hasMessages()).toBe(true);
    component.clearMessages();
    expect(component.hasMessages()).toBe(false);

    component.urlHistory.set(['wss://a.test']);
    component.clearUrlHistory();
    expect(component.urlHistory()).toEqual([]);
    expect(localStorage.getItem('websocket-client-url-history')).toBeNull();
  });
});
