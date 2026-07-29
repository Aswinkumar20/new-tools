import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { HtmlTagStripperComponent } from './html-tag-stripper';

describe('HtmlTagStripperComponent', () => {
  let component: HtmlTagStripperComponent;
  let fixture: ComponentFixture<HtmlTagStripperComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlTagStripperComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlTagStripperComponent);
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
    expect(component.preserveLineBreaks).toBe(true);
    expect(component.primarySuggestion?.id).toBe('hts-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('strips HTML tags', () => {
    component.inputText = '<p>Hello <strong>world</strong></p>';
    component.onInputChange();
    expect(component.outputText).toBe('Hello world');
    expect(component.primarySuggestion?.id).toBe('hts-stripped');
  });

  it('preserves line breaks when enabled', () => {
    component.preserveLineBreaks = true;
    component.inputText = '<p>One</p><p>Two</p>';
    component.onInputChange();
    expect(component.outputText).toContain('\n');
  });

  it('collapses breaks when preserve is off and suggests it', () => {
    component.preserveLineBreaks = false;
    component.inputText = '<p>One</p><p>Two</p>';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('hts-breaks-off');
  });

  it('suggests when input has no markup', () => {
    component.inputText = 'plain text only';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('hts-no-markup');
  });

  it('suggests when only entities are present', () => {
    component.inputText = 'Tom &amp; Jerry';
    component.onInputChange();
    expect(component.outputText).toContain('&');
    expect(component.primarySuggestion?.id).toBe('hts-entities-only');
  });

  it('flags script and style removal', () => {
    component.inputText = '<script>x()</script><p>Hi</p>';
    component.onInputChange();
    expect(component.outputText).toBe('Hi');
    expect(component.primarySuggestion?.id).toBe('hts-script-style');
  });

  it('clears with toast feedback', () => {
    component.inputText = '<p>x</p>';
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.outputText).toBe('');
    expect(toast.info).toHaveBeenCalledWith('Text cleared');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
