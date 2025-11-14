import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResumeInvoiceGeneratorComponent } from './resume-invoice-generator';

describe('ResumeInvoiceGeneratorComponent', () => {
  let component: ResumeInvoiceGeneratorComponent;
  let fixture: ComponentFixture<ResumeInvoiceGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResumeInvoiceGeneratorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ResumeInvoiceGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
