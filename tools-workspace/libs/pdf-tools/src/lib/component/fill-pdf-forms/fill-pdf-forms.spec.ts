import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { FillPdfFormsComponent } from './fill-pdf-forms';

describe('FillPdfFormsComponent', () => {
  let component: FillPdfFormsComponent;
  let fixture: ComponentFixture<FillPdfFormsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FillPdfFormsComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(FillPdfFormsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
