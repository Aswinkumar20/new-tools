import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfSummarizerComponent } from './pdf-summarizer';

describe('PdfSummarizerComponent', () => {
  let fixture: ComponentFixture<PdfSummarizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfSummarizerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfSummarizerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
