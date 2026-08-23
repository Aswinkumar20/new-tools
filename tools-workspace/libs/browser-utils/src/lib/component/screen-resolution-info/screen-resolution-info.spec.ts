import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreenResolutionInfoComponent } from './screen-resolution-info';

describe('ScreenResolutionInfoComponent', () => {
  let component: ScreenResolutionInfoComponent;
  let fixture: ComponentFixture<ScreenResolutionInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScreenResolutionInfoComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ScreenResolutionInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
