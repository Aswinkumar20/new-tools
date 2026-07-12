import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { DrawingPadComponent } from './drawing-pad';

describe('DrawingPadComponent', () => {
  let component: DrawingPadComponent;
  let fixture: ComponentFixture<DrawingPadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawingPadComponent],
      providers: ictToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(DrawingPadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
