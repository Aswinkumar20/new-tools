import { webcrypto } from 'crypto';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { PrivateNotesComponent } from './private-notes';

describe('PrivateNotesComponent', () => {
  let component: PrivateNotesComponent;
  let fixture: ComponentFixture<PrivateNotesComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivateNotesComponent],
      providers: [...stToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PrivateNotesComponent);
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
    expect(component.primarySuggestion()?.id).toBe('pn-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.statusLabel()).toBe('Empty');
  });

  it('validates encrypt without note or password', async () => {
    await component.encryptAndSave();
    expect(component.errors()[0]).toContain('note content');

    component.form.patchValue({ note: 'secret memo' });
    await component.encryptAndSave();
    expect(component.errors()[0]).toContain('password');
  });

  it('encrypts, locks, and decrypts round-trip', async () => {
    component.form.patchValue({ note: 'hello private world', password: 'correct-horse' });
    await component.encryptAndSave();

    expect(component.hasEncrypted()).toBe(true);
    expect(component.isLocked()).toBe(true);
    expect(component.form.controls.note.value).toBe('');
    expect(component.warnings()[0]).toContain('encrypted and stored in memory');
    expect(component.statusLabel()).toBe('Locked');

    await component.decrypt();
    expect(component.form.controls.note.value).toBe('hello private world');
    expect(component.form.controls.showNote.value).toBe(true);
    expect(component.isLocked()).toBe(false);
    expect(component.statusLabel()).toBe('Unlocked');
  });

  it('rejects wrong password on decrypt', async () => {
    component.form.patchValue({ note: 'top secret', password: 'right-pass' });
    await component.encryptAndSave();
    component.form.patchValue({ password: 'wrong-pass' });
    await component.decrypt();
    expect(component.errors()[0]).toContain('Failed to decrypt');
    expect(component.primarySuggestion()?.id).toBe('pn-decrypt-failed');
  });

  it('clears note text and resets session with toast feedback', () => {
    component.form.patchValue({ note: 'abc', password: 'x' });
    component.clear();
    expect(component.form.controls.note.value).toBe('');
    expect(toast.info).toHaveBeenCalledWith('Note text cleared');

    component.state.set({ encrypted: 'blob', lastSavedAt: Date.now() });
    component.clearAll();
    expect(component.hasEncrypted()).toBe(false);
    expect(component.form.controls.password.value).toBe('');
    expect(toast.info).toHaveBeenCalledWith('Private notes reset');
  });

  it('copies note with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.form.patchValue({ note: 'copy me' });
    await component.copyNote();
    expect(toast.info).toHaveBeenCalledWith('Note copied to clipboard');
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
