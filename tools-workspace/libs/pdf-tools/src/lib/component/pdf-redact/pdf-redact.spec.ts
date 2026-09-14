import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PDF_BACKEND_CONFIG, type PdfBackendConfig } from '../../api';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfRedactComponent } from './pdf-redact';

describe('PdfRedactComponent', () => {
  let fixture: ComponentFixture<PdfRedactComponent>;
  let component: PdfRedactComponent;

  const backendConfig: PdfBackendConfig = {
    enabled: true,
    baseUrl: '/api/v1/pdf',
    maxUploadMb: 50,
    largeFileThresholdMb: 8,
    largeMergeMinFiles: 5,
    advancedEnabled: true,
    tools: {},
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfRedactComponent],
      providers: [
        ...pdfToolTestProviders(),
        { provide: PDF_BACKEND_CONFIG, useValue: backendConfig },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PdfRedactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires a file plus query or regions before running', () => {
    expect(component.canRun).toBe(false);
    component.file = new File(['%PDF'], 'sample.pdf', { type: 'application/pdf' });
    expect(component.canRun).toBe(false);
    component.query = 'SSN';
    expect(component.canRun).toBe(true);
  });

  it('allows run with drawn regions and no query', () => {
    component.file = new File(['%PDF'], 'sample.pdf', { type: 'application/pdf' });
    component.regions = [{ pageIndex: 0, x: 10, y: 10, width: 40, height: 12 }];
    expect(component.canRun).toBe(true);
  });

  it('clears state without throwing', () => {
    component.file = new File(['%PDF'], 'sample.pdf', { type: 'application/pdf' });
    component.query = 'secret';
    component.regions = [{ pageIndex: 0, x: 1, y: 2, width: 3, height: 4 }];
    component.clearAll();
    expect(component.file).toBeNull();
    expect(component.query).toBe('');
    expect(component.regions).toEqual([]);
    expect(component.canDownload).toBe(false);
  });
});
