import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfColorConverterComponent } from './pdf-color-converter';

describe('PdfColorConverterComponent', () => {
  let fixture: ComponentFixture<PdfColorConverterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfColorConverterComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfColorConverterComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
