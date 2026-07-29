import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { ExtractEmailsUrlsComponent } from './extract-emails-urls';

describe('ExtractEmailsUrlsComponent', () => {
  let component: ExtractEmailsUrlsComponent;
  let fixture: ComponentFixture<ExtractEmailsUrlsComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExtractEmailsUrlsComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ExtractEmailsUrlsComponent);
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
    expect(component.primarySuggestion?.id).toBe('eeu-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('extracts emails', () => {
    component.setExtractType('emails');
    component.inputText = 'Contact user@example.com for info';
    component.onInputChange();
    expect(component.outputText).toContain('user@example.com');
    expect(component.extractedCount).toBe(1);
    expect(component.primarySuggestion?.id).toBe('eeu-found');
  });

  it('extracts urls and emails together', () => {
    component.setExtractType('both');
    component.inputText = 'Mail a@b.co and https://x.test/y';
    component.onInputChange();
    expect(component.outputText).toBe('a@b.co\nhttps://x.test/y');
    expect(component.extractedCount).toBe(2);
  });

  it('deduplicates repeated matches', () => {
    component.setExtractType('emails');
    component.inputText = 'a@b.co a@b.co a@b.co';
    component.onInputChange();
    expect(component.outputText).toBe('a@b.co');
    expect(component.extractedCount).toBe(1);
  });

  it('reports none when filter yields no matches', () => {
    component.setExtractType('urls');
    component.inputText = 'Only user@example.com here';
    component.onInputChange();
    expect(component.hasOutput).toBe(false);
    expect(component.extractedCount).toBe(0);
    expect(component.primarySuggestion?.id).toBe('eeu-none');
  });

  it('resets found count on clear', () => {
    component.inputText = 'user@example.com';
    component.onInputChange();
    component.clear();
    expect(component.extractedCount).toBe(0);
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
