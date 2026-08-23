import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { UserAgentParserComponent } from './user-agent-parser';

const CHROME_WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const GOOGLEBOT_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

describe('UserAgentParserComponent', () => {
  let component: UserAgentParserComponent;
  let fixture: ComponentFixture<UserAgentParserComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAgentParserComponent],
      providers: [...ttToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(UserAgentParserComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create and optionally load current UA when enabled', () => {
    expect(component).toBeTruthy();
    expect(component.relatedTools.length).toBeGreaterThan(0);
    if (typeof navigator !== 'undefined' && component.form.controls.useCurrent.value) {
      expect(component.hasParsed()).toBe(true);
    }
  });

  it('parses a pasted Chrome desktop UA', () => {
    component.form.controls.useCurrent.setValue(false);
    component.form.controls.userAgent.setValue(CHROME_WINDOWS_UA);
    component.onInputChange();
    expect(component.parsed()?.browser).toBe('Chrome');
    expect(component.parsed()?.deviceType).toBe('desktop');
    expect(component.primarySuggestion()?.id).toBe('uap-parsed');
  });

  it('detects bot user agents', () => {
    component.form.controls.useCurrent.setValue(false);
    component.form.controls.userAgent.setValue(GOOGLEBOT_UA);
    component.onInputChange();
    expect(component.parsed()?.isBot).toBe(true);
    expect(component.parsed()?.deviceType).toBe('bot');
    expect(component.primarySuggestion()?.id).toBe('uap-bot');
  });

  it('clears state with toast feedback', () => {
    component.form.controls.userAgent.setValue(CHROME_WINDOWS_UA);
    component.onInputChange();
    component.clear();
    expect(component.hasInput()).toBe(false);
    expect(component.hasParsed()).toBe(false);
    expect(component.form.controls.useCurrent.value).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Cleared');
    expect(component.primarySuggestion()?.id).toBe('uap-get-started');
  });

  it('reports empty parse error when Parse is clicked with blank input', () => {
    component.clear();
    component.parse();
    expect(component.errors()[0]).toContain('Enter a user agent');
    expect(component.hasParsed()).toBe(false);
  });

  it('copies parsed details with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.form.controls.useCurrent.setValue(false);
    component.form.controls.userAgent.setValue(CHROME_WINDOWS_UA);
    component.onInputChange();
    await component.copyOutput();
    expect(toast.info).toHaveBeenCalledWith('Parsed details copied to clipboard');
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
