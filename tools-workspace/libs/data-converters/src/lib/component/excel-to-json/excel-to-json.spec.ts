import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { converterTestProviders } from '../../shared/converter-test.utils';
import { ExcelToJsonComponent } from './excel-to-json';

describe('ExcelToJsonComponent', () => {
  let component: ExcelToJsonComponent;
  let fixture: ComponentFixture<ExcelToJsonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExcelToJsonComponent],
      providers: [
        ...converterTestProviders(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExcelToJsonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with idle upload state', () => {
    expect(component).toBeTruthy();
    expect(component.canConvert).toBe(false);
    expect(component.conversionStatus.status).toBe('idle');
  });

  it('loads sample preview via reset', async () => {
    await component['loadSample']();
    fixture.detectChanges();
    expect(component.fileName).toBe('sample.xlsx');
    expect(component.sheetPreview.length).toBe(3);
    expect(component.canConvert).toBe(true);
    expect(component.columnMappings.length).toBe(4);
  });

  it('errors when converting sample without a real workbook sheet', async () => {
    await component['loadSample']();
    component.convertWorkbook();
    expect(component.conversionStatus.status).toBe('error');
    expect(component.conversionStatus.message).toContain('Unable to load the selected worksheet');
  });

  it('rejects unsupported files', async () => {
    await component['loadWorkbook'](new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(component.conversionStatus.status).toBe('error');
    expect(component.diagnostics[0].level).toBe('error');
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
