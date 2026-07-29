import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { HtmlTableExporterComponent } from './html-table-exporter';

describe('HtmlTableExporterComponent', () => {
  let component: HtmlTableExporterComponent;
  let fixture: ComponentFixture<HtmlTableExporterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlTableExporterComponent],
      providers: [...cftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlTableExporterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and export the sample table on init', () => {
    expect(component).toBeTruthy();
    expect(component.hasTableData()).toBe(true);
    expect(component.hasExportResult()).toBe(true);
    expect(component.rowCount()).toBe(3);
    expect(component.columnCount()).toBe(4);
    expect(component.exportResult()?.format).toBe('csv');
    expect(component.exportResult()?.content).toContain('John Doe');
  });

  it('clears and reloads the sample table', () => {
    component.clear();
    expect(component.hasTableData()).toBe(false);
    expect(component.hasExportResult()).toBe(false);

    component.loadSample();
    expect(component.hasTableData()).toBe(true);
    expect(component.hasExportResult()).toBe(true);
  });

  it('switches export format and toggles headers', () => {
    component.onFormatChange('json');
    expect(component.exportFormat()).toBe('json');
    expect(component.exportResult()?.filename).toBe('table.json');
    expect(component.exportResult()?.content).toContain('"Name"');

    component.includeHeaders.set(false);
    component.export();
    const parsed = JSON.parse(component.exportResult()!.content);
    expect(Array.isArray(parsed[0])).toBe(true);
  });

  it('surfaces parse errors for non-table HTML', () => {
    component.onInputChange('<p>not a table</p>');
    expect(component.hasTableData()).toBe(false);
    expect(component.errors()[0]).toContain('No table found');
  });

  it('provides a dismissible suggestion', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
