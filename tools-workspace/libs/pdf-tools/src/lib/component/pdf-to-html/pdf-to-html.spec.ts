import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfToHtmlComponent } from './pdf-to-html';

describe('PdfToHtmlComponent', () => {
  let fixture: ComponentFixture<PdfToHtmlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToHtmlComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToHtmlComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
