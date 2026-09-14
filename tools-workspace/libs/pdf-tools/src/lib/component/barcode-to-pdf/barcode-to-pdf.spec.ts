import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { BarcodeToPdfComponent } from './barcode-to-pdf';

describe('BarcodeToPdfComponent', () => {
  let fixture: ComponentFixture<BarcodeToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarcodeToPdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(BarcodeToPdfComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
