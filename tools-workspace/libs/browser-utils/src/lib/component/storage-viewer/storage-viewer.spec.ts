import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { buToolTestProviders } from '../../shared/bu-tool-test.utils';
import { StorageViewerComponent } from './storage-viewer';

describe('StorageViewerComponent', () => {
  let component: StorageViewerComponent;
  let fixture: ComponentFixture<StorageViewerComponent>;
  const testKey = `__sv_test_${Date.now()}`;

  beforeEach(async () => {
    localStorage.removeItem(testKey);

    await TestBed.configureTestingModule({
      imports: [StorageViewerComponent],
      providers: [...buToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(StorageViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(testKey);
  });

  it('should create and refresh entries', () => {
    expect(component).toBeTruthy();
    localStorage.setItem(testKey, '{"hello":"world"}');
    component.refresh();
    expect(component.entries().some((entry) => entry.key === testKey)).toBe(true);
  });

  it('filters entries reactively', () => {
    localStorage.setItem(testKey, 'find-me');
    component.refresh();
    component.form.controls.filter.setValue(testKey);
    expect(component.filteredEntries().every((entry) => entry.key.includes(testKey))).toBe(true);
  });

  it('saves and removes an entry', () => {
    component.form.controls.key.setValue(testKey);
    component.form.controls.value.setValue('value-1');
    component.saveEntry();
    expect(localStorage.getItem(testKey)).toBe('value-1');

    component.removeEntry(testKey);
    expect(localStorage.getItem(testKey)).toBeNull();
  });

  it('suggests JSON tooling for JSON editor values', () => {
    component.form.controls.value.setValue('{"a":1}');
    expect(component.primarySuggestion()?.path).toBe(
      '/data-converters/json-formatter-beautifier-validator'
    );
  });

  it('dismisses the active suggestion', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
