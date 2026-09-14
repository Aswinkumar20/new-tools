import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfSensitiveDataScannerComponent } from './pdf-sensitive-data-scanner';

describe('PdfSensitiveDataScannerComponent', () => {
  let fixture: ComponentFixture<PdfSensitiveDataScannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfSensitiveDataScannerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfSensitiveDataScannerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
