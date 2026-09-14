import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfFormValidateComponent } from './pdf-form-validate';

describe('PdfFormValidateComponent', () => {
  let fixture: ComponentFixture<PdfFormValidateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfFormValidateComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfFormValidateComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
