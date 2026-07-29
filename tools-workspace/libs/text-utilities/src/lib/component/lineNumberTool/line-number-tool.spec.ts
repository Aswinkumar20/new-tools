import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { LineNumberToolComponent } from './line-number-tool';

describe('LineNumberToolComponent', () => {
  let component: LineNumberToolComponent;
  let fixture: ComponentFixture<LineNumberToolComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LineNumberToolComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LineNumberToolComponent);
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
    expect(component.mode).toBe('add');
    expect(component.startNumber).toBe(1);
    expect(component.separator).toBe('. ');
    expect(component.primarySuggestion?.id).toBe('lnt-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('adds line numbers', () => {
    component.setMode('add');
    component.inputText = 'alpha\nbeta';
    component.onInputChange();
    expect(component.outputText).toBe('1. alpha\n2. beta');
    expect(component.lineCount).toBe(2);
    expect(component.primarySuggestion?.id).toBe('lnt-added');
  });

  it('removes line numbers', () => {
    component.setMode('remove');
    component.inputText = '1. alpha\n2. beta';
    component.onInputChange();
    expect(component.outputText).toBe('alpha\nbeta');
    expect(component.primarySuggestion?.id).toBe('lnt-removed');
  });

  it('warns when adding to already-numbered input', () => {
    component.setMode('add');
    component.inputText = '1. alpha\n2. beta\n3. gamma';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('lnt-already-numbered');
  });

  it('clamps start number and reprocesses', () => {
    component.setMode('add');
    component.inputText = 'x';
    component.onInputChange();
    component.startNumber = -2.4;
    component.onStartNumberChange();
    expect(component.startNumber).toBe(0);
    expect(component.outputText).toBe('0. x');
  });

  it('switches mode by reprocessing without swapping panes', () => {
    component.setMode('add');
    component.inputText = 'a\nb';
    component.onInputChange();
    const previousInput = component.inputText;
    component.setMode('remove');
    expect(component.inputText).toBe(previousInput);
    expect(component.modeLabel).toBe('Remove numbers');
  });

  it('clears with toast feedback', () => {
    component.inputText = 'a\nb';
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
