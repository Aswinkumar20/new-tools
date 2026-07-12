import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { ResponsiveBreakpointTesterComponent } from './responsive-breakpoint-tester';

describe('ResponsiveBreakpointTesterComponent', () => {
  let component: ResponsiveBreakpointTesterComponent;
  let fixture: ComponentFixture<ResponsiveBreakpointTesterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResponsiveBreakpointTesterComponent],
      providers: ddToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ResponsiveBreakpointTesterComponent);
    component = fixture.componentInstance;
    // Preview iframe uses dynamic URLs; skip full render in unit tests.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
