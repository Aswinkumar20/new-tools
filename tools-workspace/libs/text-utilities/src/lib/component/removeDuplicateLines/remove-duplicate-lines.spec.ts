import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { RemoveDuplicateLinesComponent } from './remove-duplicate-lines';

describe('RemoveDuplicateLinesComponent', () => {
  let component: RemoveDuplicateLinesComponent;
  let fixture: ComponentFixture<RemoveDuplicateLinesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoveDuplicateLinesComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoveDuplicateLinesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('rdl-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('dedupes words on input', () => {
    component.onInputChange('team Team hello');
    expect(component.outputText).toBe('team hello');
    expect(component.removedCount).toBe(1);
    expect(component.primarySuggestion?.id).toBe('rdl-cleaned');
  });

  it('switches to line mode', () => {
    component.setDedupMode('lines');
    component.onInputChange('a\na\nb');
    expect(component.outputText).toBe('a\nb');
  });

  it('apply cleanup updates source', () => {
    component.onInputChange('dup dup word');
    component.applyCleanup();
    expect(component.inputText).toBe('dup word');
  });

  it('dismisses the active suggestion', () => {
    expect(component.primarySuggestion?.id).toBe('rdl-get-started');
    component.dismissSuggestion('rdl-get-started');
    expect(component.primarySuggestion).toBeNull();
  });

  it('suggests lines mode for repeated rows while in words mode', () => {
    component.setDedupMode('words');
    component.onInputChange('alpha\nbeta\nalpha\nalpha');
    expect(component.primarySuggestion?.id).toBe('rdl-duplicate-lines');
  });
});
