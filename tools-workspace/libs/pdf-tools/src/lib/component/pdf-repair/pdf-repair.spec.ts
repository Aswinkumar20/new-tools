import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfRepairComponent } from './pdf-repair';

describe('PdfRepairComponent', () => {
  let fixture: ComponentFixture<PdfRepairComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfRepairComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfRepairComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
