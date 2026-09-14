import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfLinkExtractorComponent } from './pdf-link-extractor';

describe('PdfLinkExtractorComponent', () => {
  let fixture: ComponentFixture<PdfLinkExtractorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfLinkExtractorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfLinkExtractorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
