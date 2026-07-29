import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { HexEncodeDecodeComponent } from './hex-encode-decode';

describe('HexEncodeDecodeComponent', () => {
  let component: HexEncodeDecodeComponent;
  let fixture: ComponentFixture<HexEncodeDecodeComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HexEncodeDecodeComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(HexEncodeDecodeComponent);
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
    expect(component.primarySuggestion?.id).toBe('hex-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('hex encodes text', () => {
    component.selectMode('encode');
    component.inputText = 'hi';
    component.onInputChange();
    expect(component.outputText.replace(/\s/g, '').toLowerCase()).toBe('6869');
    expect(component.primarySuggestion?.id).toBe('hex-encoded');
  });

  it('decodes hex to text', () => {
    component.selectMode('decode');
    component.inputText = '68 69';
    component.onInputChange();
    expect(component.outputText).toBe('hi');
    expect(component.primarySuggestion?.id).toBe('hex-decoded');
  });

  it('reports invalid hex length', () => {
    component.selectMode('decode');
    component.inputText = '686';
    component.onInputChange();
    expect(component.errorMessage).toContain('Invalid hex string length');
    expect(component.hasOutput).toBe(false);
    expect(component.primarySuggestion?.id).toBe('hex-error');
  });

  it('re-encodes when separator changes', () => {
    component.selectMode('encode');
    component.inputText = 'hi';
    component.onInputChange();
    component.setSeparator('colon');
    expect(component.outputText).toBe('68:69');
  });

  it('suggests decode when encode input looks like hex', () => {
    component.selectMode('encode');
    component.inputText = '68 69 6f';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('hex-looks-hex');
  });

  it('clears with toast feedback', () => {
    component.inputText = 'hi';
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
