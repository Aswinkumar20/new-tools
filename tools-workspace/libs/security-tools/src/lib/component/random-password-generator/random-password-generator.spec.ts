import { webcrypto } from 'crypto';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { RandomPasswordGeneratorComponent } from './random-password-generator';

describe('RandomPasswordGeneratorComponent', () => {
  let component: RandomPasswordGeneratorComponent;
  let fixture: ComponentFixture<RandomPasswordGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RandomPasswordGeneratorComponent],
      providers: [...stToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(RandomPasswordGeneratorComponent);
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
    expect(component.primarySuggestion()?.id).toBe('rpg-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.passwordLength()).toBe(16);
  });

  it('generates a password with default options', () => {
    component.generate();
    expect(component.hasPassword()).toBe(true);
    expect(component.password()?.value.length).toBe(16);
    expect(component.errors()).toEqual([]);
    expect(component.generatedTimeLabel()).not.toBe('—');
  });

  it('rejects empty character sets', () => {
    component.form.patchValue({
      includeLowercase: false,
      includeUppercase: false,
      includeNumbers: false,
      includeSymbols: false
    });
    component.generate();
    expect(component.hasPassword()).toBe(false);
    expect(component.errors()[0]).toContain('at least one character set');
    expect(component.primarySuggestion()?.id).toBe('rpg-charset');
  });

  it('rejects out-of-range length', () => {
    component.form.patchValue({ length: 2 });
    component.generate();
    expect(component.hasPassword()).toBe(false);
    expect(component.errors()[0]).toContain('between 4 and 128');
  });

  it('clears password with toast feedback', () => {
    component.generate();
    component.clear();
    expect(component.hasPassword()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Password cleared');
  });

  it('copies password with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.generate();
    await component.copyToClipboard();
    expect(toast.info).toHaveBeenCalledWith('Password copied to clipboard');
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
