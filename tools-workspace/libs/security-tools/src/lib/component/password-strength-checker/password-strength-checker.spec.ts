import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { PasswordStrengthCheckerComponent } from './password-strength-checker';

describe('PasswordStrengthCheckerComponent', () => {
  let component: PasswordStrengthCheckerComponent;
  let fixture: ComponentFixture<PasswordStrengthCheckerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordStrengthCheckerComponent],
      providers: [...stToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordStrengthCheckerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with generator suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('psc-generate');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.strengthLabel()).toBe('Very weak');
  });

  it('scores a weak common password', () => {
    component.form.patchValue({ password: 'password' });
    expect(component.hasPassword()).toBe(true);
    expect(component.strengthLevel()).toBe('weak');
    expect(component.suggestions().some((t) => t.includes('common passwords'))).toBe(true);
    expect(component.primarySuggestion()?.id).toBe('psc-weak');
  });

  it('scores a stronger mixed password', () => {
    component.form.patchValue({ password: 'Tr0ub4dor&3xtraLong!' });
    expect(component.strengthScore()).toBeGreaterThanOrEqual(8);
    expect(['strong', 'very-strong']).toContain(component.strengthLevel());
  });

  it('clears password with toast feedback', () => {
    component.form.patchValue({ password: 'abc' });
    component.clear();
    expect(component.form.controls.password.value).toBe('');
    expect(toast.info).toHaveBeenCalledWith('Password cleared');
  });

  it('copies password with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.form.patchValue({ password: 'Secret123!' });
    await component.copyPassword();
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
