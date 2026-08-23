import { webcrypto } from 'crypto';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { SECURE_CLIPBOARD_EXPIRED_WARNING } from '../../constants/secure-clipboard.constants';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { SecureClipboardComponent } from './secure-clipboard';

describe('SecureClipboardComponent', () => {
  let component: SecureClipboardComponent;
  let fixture: ComponentFixture<SecureClipboardComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  });

  beforeEach(async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });

    await TestBed.configureTestingModule({
      imports: [SecureClipboardComponent],
      providers: [...stToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(SecureClipboardComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('sc-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.statusLabel()).toBe('Empty');
  });

  it('validates secure copy inputs', async () => {
    await component.copyToSecureClipboard();
    expect(component.errors()[0]).toContain('Enter some text');

    component.form.patchValue({ text: 'secret' });
    await component.copyToSecureClipboard();
    expect(component.errors()[0]).toContain('password');

    component.form.patchValue({ password: 'pw', ttlSeconds: 0 });
    await component.copyToSecureClipboard();
    expect(component.errors()[0]).toContain('greater than 0');
  });

  it('secure-copies text into an active store', async () => {
    component.form.patchValue({ text: 'sensitive', password: 'pass-1', ttlSeconds: 60 });
    await component.copyToSecureClipboard();

    expect(component.hasStored()).toBe(true);
    expect(component.isExpired()).toBe(false);
    expect(component.statusLabel()).toBe('Active');
    expect(component.warnings()[0]).toContain('encrypted in memory');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('sensitive');
    expect(component.primarySuggestion()?.id).toBe('sc-active');
  });

  it('clears store on TTL expiry', () => {
    jest.useFakeTimers();
    fixture.destroy();
    fixture = TestBed.createComponent(SecureClipboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const expiresAt = Date.now() + 500;
    component.state.set({ stored: 'encrypted-blob', expiresAt });
    expect(component.hasStored()).toBe(true);

    jest.advanceTimersByTime(1000);

    expect(component.hasStored()).toBe(false);
    expect(component.warnings()[0]).toBe(SECURE_CLIPBOARD_EXPIRED_WARNING);
    expect(component.primarySuggestion()?.id).toBe('sc-expired');

    fixture.destroy();
    jest.useRealTimers();
  });

  it('clears store and text with toast feedback', () => {
    component.state.set({ stored: 'blob', expiresAt: Date.now() + 10_000 });
    component.clearClipboard();
    expect(component.hasStored()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Secure store cleared');

    component.form.patchValue({ text: 'abc' });
    component.clearText();
    expect(component.form.controls.text.value).toBe('');
    expect(toast.info).toHaveBeenCalledWith('Text cleared');
  });

  it('copies plain text with toast feedback', async () => {
    component.form.patchValue({ text: 'plain copy' });
    await component.copyText();
    expect(toast.info).toHaveBeenCalledWith('Text copied to clipboard');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
