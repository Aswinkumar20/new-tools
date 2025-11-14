import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClipboardHistoryComponent } from './clipboard-history';

describe('ClipboardHistoryComponent', () => {
  let component: ClipboardHistoryComponent;
  let fixture: ComponentFixture<ClipboardHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClipboardHistoryComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ClipboardHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
