import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfDpiConverterComponent } from './pdf-dpi-converter';

describe('PdfDpiConverterComponent', () => {
  let fixture: ComponentFixture<PdfDpiConverterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfDpiConverterComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfDpiConverterComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
