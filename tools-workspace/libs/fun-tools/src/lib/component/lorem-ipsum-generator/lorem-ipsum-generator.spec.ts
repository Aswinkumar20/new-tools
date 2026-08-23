import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { LoremIpsumGeneratorComponent } from './lorem-ipsum-generator';

describe('LoremIpsumGeneratorComponent', () => {
  let component: LoremIpsumGeneratorComponent;
  let fixture: ComponentFixture<LoremIpsumGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoremIpsumGeneratorComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LoremIpsumGeneratorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create and auto-generate on construct', () => {
    expect(component).toBeTruthy();
    expect(component.hasGeneratedText()).toBe(true);
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()).toBeTruthy();
  });

  it('validates count limits with legacy messages', () => {
    component.form.setValue({ type: 'paragraphs', count: 0, startWith: 'lorem' });
    component.generate();
    expect(component.errors()).toEqual(['Count must be at least 1.']);

    component.form.setValue({ type: 'words', count: 1001, startWith: 'lorem' });
    component.generate();
    expect(component.errors()).toEqual(['Maximum 1000 words allowed.']);
  });

  it('clears generated text', () => {
    expect(component.hasGeneratedText()).toBe(true);
    component.clearText();
    expect(component.hasGeneratedText()).toBe(false);
    expect(component.primarySuggestion()?.id).toBe('lig-flashcards');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies generated text with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyToClipboard();
    expect(toast.info).toHaveBeenCalledWith('Generated text copied to clipboard');
  });

  it('exposes max count for the selected type', () => {
    component.form.controls.type.setValue('sentences');
    fixture.detectChanges();
    expect(component.countMax()).toBe(200);
  });
});
