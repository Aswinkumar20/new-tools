import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfDiffComponent } from './pdf-diff';

describe('PdfDiffComponent', () => {
  let fixture: ComponentFixture<PdfDiffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfDiffComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfDiffComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
