import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfValidatorComponent } from './pdf-validator';

describe('PdfValidatorComponent', () => {
  let fixture: ComponentFixture<PdfValidatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfValidatorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfValidatorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
