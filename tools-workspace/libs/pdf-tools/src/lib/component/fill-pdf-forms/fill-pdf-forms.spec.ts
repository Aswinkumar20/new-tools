import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FillPdfFormsComponent } from './fill-pdf-forms';

describe('FillPdfFormsComponent', () => {
  let component: FillPdfFormsComponent;
  let fixture: ComponentFixture<FillPdfFormsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FillPdfFormsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FillPdfFormsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
