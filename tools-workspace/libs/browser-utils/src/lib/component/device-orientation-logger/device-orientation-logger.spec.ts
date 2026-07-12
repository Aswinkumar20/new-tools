import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buToolTestProviders } from '../../shared/bu-tool-test.utils';
import { DeviceOrientationLoggerComponent } from './device-orientation-logger';

describe('DeviceOrientationLoggerComponent', () => {
  let component: DeviceOrientationLoggerComponent;
  let fixture: ComponentFixture<DeviceOrientationLoggerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeviceOrientationLoggerComponent],
      providers: buToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceOrientationLoggerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
