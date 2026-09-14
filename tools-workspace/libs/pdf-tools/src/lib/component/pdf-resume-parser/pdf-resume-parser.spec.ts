import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfResumeParserComponent } from './pdf-resume-parser';

describe('PdfResumeParserComponent', () => {
  let fixture: ComponentFixture<PdfResumeParserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfResumeParserComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfResumeParserComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
