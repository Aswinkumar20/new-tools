import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { Rot13CipherComponent } from './rot13-cipher';

describe('Rot13CipherComponent', () => {
  let component: Rot13CipherComponent;
  let fixture: ComponentFixture<Rot13CipherComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rot13CipherComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Rot13CipherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.cipherMode).toBe('rot13');
    expect(component.caesarShift).toBe(3);
    expect(component.primarySuggestion?.id).toBe('rot13-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('applies ROT13', () => {
    component.inputText = 'Hello';
    component.onInputChange();
    expect(component.outputText).toBe('Uryyb');
    expect(component.primarySuggestion?.id).toBe('rot13-encoded');
  });

  it('applies Caesar shift', () => {
    component.setCipherMode('caesar');
    component.caesarShift = 1;
    component.onCaesarShiftChange();
    component.inputText = 'ABC';
    component.onInputChange();
    expect(component.outputText).toBe('BCD');
    expect(component.primarySuggestion?.id).toBe('rot13-caesar-encoded');
  });

  it('clamps caesar shift', () => {
    component.setCipherMode('caesar');
    component.caesarShift = 99;
    component.onCaesarShiftChange();
    expect(component.caesarShift).toBe(25);
  });

  it('suggests when input has no letters', () => {
    component.inputText = '123!';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('rot13-no-letters');
  });

  it('suggests ROT13 when Caesar shift is 13', () => {
    component.setCipherMode('caesar');
    component.caesarShift = 13;
    component.onCaesarShiftChange();
    component.inputText = 'Hello';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('rot13-caesar-13');
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
