import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { UserAgentParserComponent } from './user-agent-parser';

describe('UserAgentParserComponent', () => {
  let component: UserAgentParserComponent;
  let fixture: ComponentFixture<UserAgentParserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAgentParserComponent],
      providers: ttToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(UserAgentParserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
