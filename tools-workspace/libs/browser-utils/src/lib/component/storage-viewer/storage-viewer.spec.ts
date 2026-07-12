import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buToolTestProviders } from '../../shared/bu-tool-test.utils';
import { StorageViewerComponent } from './storage-viewer';

describe('StorageViewerComponent', () => {
  let component: StorageViewerComponent;
  let fixture: ComponentFixture<StorageViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageViewerComponent],
      providers: buToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(StorageViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
