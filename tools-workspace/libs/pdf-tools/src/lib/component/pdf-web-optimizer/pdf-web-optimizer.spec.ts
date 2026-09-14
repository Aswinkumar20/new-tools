import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfWebOptimizerComponent } from './pdf-web-optimizer';

describe('PdfWebOptimizerComponent', () => {
  let fixture: ComponentFixture<PdfWebOptimizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfWebOptimizerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfWebOptimizerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
