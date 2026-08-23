import { webcrypto } from 'crypto';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { TextEncryptDecryptComponent } from './text-encrypt-decrypt';

describe('TextEncryptDecryptComponent', () => {
  let component: TextEncryptDecryptComponent;
  let fixture: ComponentFixture<TextEncryptDecryptComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextEncryptDecryptComponent],
      providers: [...stToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(TextEncryptDecryptComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('ted-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.isEncryptMode()).toBe(true);
  });

  it('validates encrypt without password or plaintext', async () => {
    await component.run();
    expect(component.errors()[0]).toContain('password');

    component.form.patchValue({ password: 'secret' });
    await component.run();
    expect(component.errors()[0]).toContain('plaintext');
  });

  it('encrypts and decrypts round-trip', async () => {
    component.form.patchValue({
      mode: 'encrypt',
      plaintext: 'hello crypto',
      password: 'passphrase-1'
    });
    await component.run();

    expect(component.hasOutput()).toBe(true);
    expect(component.state().lastAction).toBe('encrypt');
    expect(component.form.controls.ciphertext.value.length).toBeGreaterThan(20);
    expect(component.primarySuggestion()?.id).toBe('ted-after-encrypt');

    const cipher = component.form.controls.ciphertext.value;
    component.setMode('decrypt');
    component.form.patchValue({ ciphertext: cipher, password: 'passphrase-1' });
    await component.run();

    expect(component.state().output).toBe('hello crypto');
    expect(component.form.controls.plaintext.value).toBe('hello crypto');
    expect(component.state().lastAction).toBe('decrypt');
  });

  it('rejects wrong password on decrypt', async () => {
    component.form.patchValue({
      mode: 'encrypt',
      plaintext: 'secret note',
      password: 'right'
    });
    await component.run();
    const cipher = component.form.controls.ciphertext.value;

    component.setMode('decrypt');
    component.form.patchValue({ ciphertext: cipher, password: 'wrong' });
    await component.run();

    expect(component.errors()[0]).toContain('Operation failed');
    expect(component.primarySuggestion()?.id).toBe('ted-failed');
  });

  it('swaps mode and clears with toast feedback', () => {
    component.swapMode();
    expect(component.isEncryptMode()).toBe(false);
    component.setMode('encrypt');
    expect(component.isEncryptMode()).toBe(true);

    component.form.patchValue({ plaintext: 'x', ciphertext: 'y', password: 'z' });
    component.state.set({ output: 'out', lastAction: 'encrypt' });
    component.clearAll();
    expect(component.form.controls.plaintext.value).toBe('');
    expect(component.hasOutput()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Cleared');
  });

  it('copies output with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.state.set({ output: 'blob', lastAction: 'encrypt' });
    await component.copyOutput();
    expect(toast.info).toHaveBeenCalledWith('Output copied to clipboard');
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
