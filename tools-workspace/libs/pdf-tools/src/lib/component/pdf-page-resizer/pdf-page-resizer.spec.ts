import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfPageResizerComponent } from './pdf-page-resizer';

describe('PdfPageResizerComponent', () => {
  let fixture: ComponentFixture<PdfPageResizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfPageResizerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfPageResizerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
