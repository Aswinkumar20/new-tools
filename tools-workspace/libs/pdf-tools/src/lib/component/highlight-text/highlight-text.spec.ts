import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HighlightTextComponent } from './highlight-text';

describe('HighlightTextComponent', () => {
  let component: HighlightTextComponent;
  let fixture: ComponentFixture<HighlightTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HighlightTextComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HighlightTextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
