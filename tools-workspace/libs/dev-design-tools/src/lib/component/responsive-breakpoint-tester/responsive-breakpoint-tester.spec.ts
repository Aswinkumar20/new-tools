import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResponsiveBreakpointTesterComponent } from './responsive-breakpoint-tester';

describe('ResponsiveBreakpointTesterComponent', () => {
  let component: ResponsiveBreakpointTesterComponent;
  let fixture: ComponentFixture<ResponsiveBreakpointTesterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResponsiveBreakpointTesterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ResponsiveBreakpointTesterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
