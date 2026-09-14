import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfReferenceExtractorComponent } from './pdf-reference-extractor';

describe('PdfReferenceExtractorComponent', () => {
  let fixture: ComponentFixture<PdfReferenceExtractorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfReferenceExtractorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfReferenceExtractorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
