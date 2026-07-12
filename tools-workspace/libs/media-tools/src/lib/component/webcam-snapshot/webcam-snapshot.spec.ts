import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mtToolTestProviders } from '../../shared/mt-tool-test.utils';
import { WebcamSnapshotComponent } from './webcam-snapshot';

describe('WebcamSnapshotComponent', () => {
  let component: WebcamSnapshotComponent;
  let fixture: ComponentFixture<WebcamSnapshotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebcamSnapshotComponent],
      providers: mtToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(WebcamSnapshotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
