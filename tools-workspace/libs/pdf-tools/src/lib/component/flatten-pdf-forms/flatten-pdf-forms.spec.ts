import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlattenPdfFormsComponent } from './flatten-pdf-forms';

describe('FlattenPdfFormsComponent', () => {
  let component: FlattenPdfFormsComponent;
  let fixture: ComponentFixture<FlattenPdfFormsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlattenPdfFormsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FlattenPdfFormsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
