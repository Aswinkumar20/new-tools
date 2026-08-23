import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TextToASCIIComponent } from './text-to-ASCII';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';

describe('TextToASCIIComponent', () => {
  let component: TextToASCIIComponent;
  let fixture: ComponentFixture<TextToASCIIComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextToASCIIComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TextToASCIIComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('tta-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('converts text to ascii', () => {
    component.leftType = 'text';
    component.rightType = 'ascii';
    component.inputValue = 'Hi';
    component.convert();
    expect(component.outputValue).toBe('72 105');
    expect(component.primarySuggestion?.id).toBe('tta-encoded');
  });

  it('decodes ascii to text', () => {
    component.leftType = 'ascii';
    component.rightType = 'text';
    component.inputValue = '72 105';
    component.convert();
    expect(component.outputValue).toBe('Hi');
    expect(component.primarySuggestion?.id).toBe('tta-decoded');
  });

  it('surfaces format errors', () => {
    component.leftType = 'ascii';
    component.rightType = 'text';
    component.inputValue = 'not-ascii';
    component.convert();
    expect(component.errorMessage).toBeTruthy();
    expect(component.outputValue).toBe('');
    expect(component.primarySuggestion?.id).toBe('tta-format-error');
  });

  it('swaps types and values', () => {
    component.leftType = 'text';
    component.rightType = 'ascii';
    component.inputValue = 'Hi';
    component.convert();
    component.swapTypes();
    expect(component.leftType).toBe('ascii');
    expect(component.rightType).toBe('text');
    expect(component.inputValue).toBe('72 105');
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
