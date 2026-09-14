import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { InvoiceGeneratorComponent } from './invoice-generator';

describe('InvoiceGeneratorComponent', () => {
  let fixture: ComponentFixture<InvoiceGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoiceGeneratorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(InvoiceGeneratorComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
