import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { EmailUrlIpCheckerComponent } from './email-url-ip-checker';

describe('EmailUrlIpCheckerComponent', () => {
  let component: EmailUrlIpCheckerComponent;
  let fixture: ComponentFixture<EmailUrlIpCheckerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailUrlIpCheckerComponent],
      providers: [...ttToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(EmailUrlIpCheckerComponent);
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
    expect(component.primarySuggestion()?.id).toBe('eui-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.modeLabel()).toBe('Auto');
  });

  it('analyzes mixed values with auto-detect', () => {
    component.form.patchValue({
      input: 'john.doe@example.com\nhttps://example.com/path\n192.168.0.10'
    });
    component.analyze();

    expect(component.totalCount()).toBe(3);
    expect(component.validCount()).toBe(3);
    expect(component.typeCounts().email).toBe(1);
    expect(component.typeCounts().url).toBe(1);
    expect(component.typeCounts().ip).toBe(1);
    expect(component.primarySuggestion()?.id).toBe('eui-ip-ok');
  });

  it('flags invalid emails and disposable domains', () => {
    component.form.patchValue({ input: 'not-an-email', mode: 'email' });
    component.analyze();
    expect(component.results()[0].valid).toBe(false);
    expect(component.primarySuggestion()?.id).toBe('eui-invalid');

    component.form.patchValue({ input: 'a@mailinator.com', mode: 'email' });
    component.analyze();
    expect(component.results()[0].info['isDisposableDomain']).toBe(true);
    expect(component.primarySuggestion()?.id).toBe('eui-disposable');
  });

  it('clears with toast feedback', () => {
    component.form.patchValue({ input: 'https://example.com' });
    component.analyze();
    component.clear();
    expect(component.hasInput()).toBe(false);
    expect(component.hasResults()).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Cleared');
  });

  it('copies results with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.form.patchValue({ input: 'https://example.com' });
    component.analyze();
    await component.copyOutput();
    expect(toast.info).toHaveBeenCalledWith('Results copied to clipboard');
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
