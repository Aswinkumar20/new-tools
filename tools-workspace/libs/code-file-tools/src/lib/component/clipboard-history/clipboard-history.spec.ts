import { ComponentFixture, TestBed } from '@angular/core/testing';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { ClipboardHistoryComponent } from './clipboard-history';

describe('ClipboardHistoryComponent', () => {
  let component: ClipboardHistoryComponent;
  let fixture: ComponentFixture<ClipboardHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClipboardHistoryComponent],
      providers: cftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ClipboardHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
