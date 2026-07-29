import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { InvisibleCharacterDetectorComponent } from './invisible-character-detector';

describe('InvisibleCharacterDetectorComponent', () => {
  let component: InvisibleCharacterDetectorComponent;
  let fixture: ComponentFixture<InvisibleCharacterDetectorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvisibleCharacterDetectorComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(InvisibleCharacterDetectorComponent);
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
    expect(component.primarySuggestion?.id).toBe('icd-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('detects zero-width space and annotates output', () => {
    component.inputText = `a\u200bb`;
    component.onInputChange();
    expect(component.invisibleCount).toBe(1);
    expect(component.outputText).toContain('[ZERO WIDTH SPACE]');
    expect(component.primarySuggestion?.id).toBe('icd-zero-width');
  });

  it('shows clean suggestion when nothing is found', () => {
    component.inputText = 'plain text';
    component.onInputChange();
    expect(component.invisibleCount).toBe(0);
    expect(component.hasOutput).toBe(false);
    expect(component.primarySuggestion?.id).toBe('icd-clean');
  });

  it('flags BOM detections', () => {
    component.inputText = `\ufeffhello`;
    component.onInputChange();
    expect(component.invisibleCount).toBeGreaterThan(0);
    expect(component.primarySuggestion?.id).toBe('icd-bom');
  });

  it('flags non-breaking spaces', () => {
    component.inputText = `a\u00a0b`;
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('icd-nbsp');
  });

  it('formats hit code points', () => {
    expect(component.formatHitCodePoint(0x200b)).toBe('U+200B');
  });

  it('clears with toast feedback', () => {
    component.inputText = `a\u200bb`;
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.outputText).toBe('');
    expect(component.invisibleHits).toEqual([]);
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
