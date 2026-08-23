import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { converterTestProviders } from '../../shared/converter-test.utils';
import { HtmlTableToJsonComponent } from './html-table-to-json';

describe('HtmlTableToJsonComponent', () => {
  let component: HtmlTableToJsonComponent;
  let fixture: ComponentFixture<HtmlTableToJsonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlTableToJsonComponent],
      providers: [...converterTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlTableToJsonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load sample HTML on init', () => {
    expect(component).toBeTruthy();
    expect(component.htmlInput).toContain('Ada Lovelace');
    expect(component.selectionMode).toBe('auto');
  });

  it('converts the sample table to JSON', () => {
    component.convert();
    expect(component.conversionStatus.status).toBe('success');
    expect(component.resultOutput).toContain('"Ada Lovelace"');
    expect(component.metrics.rows).toBe(3);
    expect(component.operationHistory[0].label).toBe('Converted HTML table to JSON');
  });

  it('surfaces an error for empty input', () => {
    component.htmlInput = '';
    component.convert();
    expect(component.conversionStatus.status).toBe('error');
    expect(component.conversionStatus.message).toContain('empty');
  });

  it('requires a selector in custom mode', () => {
    component.onSelectionModeChange('custom');
    component.convert();
    expect(component.conversionStatus.status).toBe('error');
    expect(component.conversionStatus.message).toContain('CSS selector');
  });

  it('provides a dismissible suggestion', () => {
    expect(component.primarySuggestion).toBeTruthy();
    const suggestion = component.primarySuggestion;
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
