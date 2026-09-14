import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfToPdfaComponent } from './pdf-to-pdfa';

describe('PdfToPdfaComponent', () => {
  let fixture: ComponentFixture<PdfToPdfaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToPdfaComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToPdfaComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
