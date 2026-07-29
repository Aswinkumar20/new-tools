import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { converterTestProviders } from '../../shared/converter-test.utils';
import { CsvToJsonJsonToCsvComponent } from './csv-to-json-json-to-csv';

describe('CsvToJsonJsonToCsvComponent', () => {
  let component: CsvToJsonJsonToCsvComponent;
  let fixture: ComponentFixture<CsvToJsonJsonToCsvComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CsvToJsonJsonToCsvComponent],
      providers: [...converterTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(CsvToJsonJsonToCsvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load sample CSV on init', () => {
    expect(component).toBeTruthy();
    expect(component.conversionMode).toBe('csv-to-json');
    expect(component.csvInput).toContain('Ada Lovelace');
    expect(component.metrics.rows).toBeGreaterThan(0);
  });

  it('converts CSV to JSON', () => {
    component.convert();
    expect(component.conversionStatus.status).toBe('success');
    expect(component.resultOutput).toContain('"Ada Lovelace"');
    expect(component.operationHistory[0].label).toBe('Converted CSV to JSON');
  });

  it('switches mode and converts JSON to CSV', () => {
    component.onModeChange('json-to-csv');
    expect(component.conversionMode).toBe('json-to-csv');
    expect(component.jsonInput).toContain('Notebook');

    component.convert();
    expect(component.conversionStatus.status).toBe('success');
    expect(component.resultOutput).toContain('Notebook');
  });

  it('surfaces an error for empty CSV conversion', () => {
    component.csvInput = '';
    component.convert();
    expect(component.conversionStatus.status).toBe('error');
    expect(component.conversionStatus.message).toContain('empty');
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
