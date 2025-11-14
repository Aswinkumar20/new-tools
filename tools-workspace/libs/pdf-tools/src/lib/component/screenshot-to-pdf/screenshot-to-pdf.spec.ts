import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreenshotToPdfComponent } from './screenshot-to-pdf';

describe('ScreenshotToPdfComponent', () => {
  let component: ScreenshotToPdfComponent;
  let fixture: ComponentFixture<ScreenshotToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScreenshotToPdfComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ScreenshotToPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
