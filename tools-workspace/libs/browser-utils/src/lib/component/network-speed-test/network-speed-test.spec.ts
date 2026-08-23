import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NetworkSpeedTestComponent } from './network-speed-test';

describe('NetworkSpeedTestComponent', () => {
  let component: NetworkSpeedTestComponent;
  let fixture: ComponentFixture<NetworkSpeedTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NetworkSpeedTestComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(NetworkSpeedTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
