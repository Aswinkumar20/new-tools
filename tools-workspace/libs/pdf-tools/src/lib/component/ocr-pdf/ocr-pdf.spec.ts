import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { OcrPdfComponent } from './ocr-pdf';

describe('OcrPdfComponent', () => {
  let fixture: ComponentFixture<OcrPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OcrPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(OcrPdfComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
