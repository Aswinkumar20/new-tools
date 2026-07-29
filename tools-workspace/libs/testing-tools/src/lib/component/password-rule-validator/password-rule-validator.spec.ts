import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { PasswordRuleValidatorComponent } from './password-rule-validator';

describe('PasswordRuleValidatorComponent', () => {
  let component: PasswordRuleValidatorComponent;
  let fixture: ComponentFixture<PasswordRuleValidatorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordRuleValidatorComponent],
      providers: [...ttToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordRuleValidatorComponent);
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
    expect(component.primarySuggestion()?.id).toBe('prv-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.totalCount()).toBe(7);
  });

  it('updates rules live when password changes', () => {
    component.form.controls.password.setValue('CorrectHorseBattery!9');
    fixture.detectChanges();
    expect(component.hasInput()).toBe(true);
    expect(component.allPassed()).toBe(true);
    expect(component.primarySuggestion()?.id).toBe('prv-pass');
  });

  it('flags common passwords', () => {
    component.form.patchValue({ password: 'password', minLength: 8 });
    fixture.detectChanges();
    expect(component.rules().find((rule) => rule.id === 'noCommon')?.passed).toBe(false);
    expect(component.primarySuggestion()?.id).toBe('prv-common');
  });

  it('respects disabled requirements', () => {
    component.form.patchValue({
      password: 'abcdefghijkl',
      requireUppercase: false,
      requireNumber: false,
      requireSymbol: false,
      noSpaces: false,
      noCommon: false
    });
    fixture.detectChanges();
    expect(component.totalCount()).toBe(2);
    expect(component.allPassed()).toBe(true);
  });

  it('toggles password visibility', () => {
    expect(component.showPassword()).toBe(false);
    component.toggleShowPassword();
    expect(component.showPassword()).toBe(true);
  });

  it('clears with toast feedback', () => {
    component.form.controls.password.setValue('Secret123!');
    fixture.detectChanges();
    component.clear();
    expect(component.hasInput()).toBe(false);
    expect(component.showPassword()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Cleared');
  });

  it('copies checklist with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.form.controls.password.setValue('Secret123!');
    fixture.detectChanges();
    await component.copyOutput();
    expect(toast.info).toHaveBeenCalledWith('Rule checklist copied to clipboard');
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
