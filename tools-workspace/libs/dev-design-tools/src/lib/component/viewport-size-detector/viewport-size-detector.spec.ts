import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewportSizeDetectorComponent } from './viewport-size-detector';

describe('ViewportSizeDetectorComponent', () => {
  let component: ViewportSizeDetectorComponent;
  let fixture: ComponentFixture<ViewportSizeDetectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewportSizeDetectorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ViewportSizeDetectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
