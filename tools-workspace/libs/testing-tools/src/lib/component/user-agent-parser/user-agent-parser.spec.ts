import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserAgentParserComponent } from './user-agent-parser';

describe('UserAgentParserComponent', () => {
  let component: UserAgentParserComponent;
  let fixture: ComponentFixture<UserAgentParserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAgentParserComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UserAgentParserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
