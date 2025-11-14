import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnnotatePdfComponent } from './annotate-pdf';

describe('AnnotatePdfComponent', () => {
  let component: AnnotatePdfComponent;
  let fixture: ComponentFixture<AnnotatePdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotatePdfComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotatePdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
