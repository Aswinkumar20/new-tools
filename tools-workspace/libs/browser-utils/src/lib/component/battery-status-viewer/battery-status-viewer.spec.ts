import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BatteryStatusViewerComponent } from './battery-status-viewer';

describe('BatteryStatusViewerComponent', () => {
  let component: BatteryStatusViewerComponent;
  let fixture: ComponentFixture<BatteryStatusViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BatteryStatusViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(BatteryStatusViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
