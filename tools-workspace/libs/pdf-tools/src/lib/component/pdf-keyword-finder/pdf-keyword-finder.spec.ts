import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfKeywordFinderComponent } from './pdf-keyword-finder';

describe('PdfKeywordFinderComponent', () => {
  let fixture: ComponentFixture<PdfKeywordFinderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfKeywordFinderComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfKeywordFinderComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
