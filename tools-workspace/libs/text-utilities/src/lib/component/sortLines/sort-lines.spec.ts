import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { SortLinesComponent } from './sort-lines';

describe('SortLinesComponent', () => {
  let component: SortLinesComponent;
  let fixture: ComponentFixture<SortLinesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SortLinesComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SortLinesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.sortMode).toBe('az');
    expect(component.primarySuggestion?.id).toBe('sort-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('sorts lines alphabetically', () => {
    component.inputText = 'c\na\nb';
    component.onInputChange();
    expect(component.outputText).toBe('a\nb\nc');
    expect(component.primarySuggestion?.id).toBe('sort-sorted');
  });

  it('sorts lines in reverse order', () => {
    component.setSortMode('za');
    component.inputText = 'a\nb\nc';
    component.onInputChange();
    expect(component.outputText).toBe('c\nb\na');
  });

  it('suggests numeric mode for numeric-looking lines', () => {
    component.setSortMode('az');
    component.inputText = '10\n2\n1';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('sort-looks-numeric');
  });

  it('suggests dedupe when duplicates exist', () => {
    component.inputText = 'b\na\nb';
    component.onInputChange();
    expect(component.primarySuggestion?.id).toBe('sort-has-duplicates');
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
