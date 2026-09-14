import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfGrayscaleConverterComponent } from './pdf-grayscale-converter';

describe('PdfGrayscaleConverterComponent', () => {
  let fixture: ComponentFixture<PdfGrayscaleConverterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfGrayscaleConverterComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfGrayscaleConverterComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
