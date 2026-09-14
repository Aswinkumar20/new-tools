import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfToDocxComponent } from './pdf-to-docx';

describe('PdfToDocxComponent', () => {
  let fixture: ComponentFixture<PdfToDocxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToDocxComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToDocxComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
