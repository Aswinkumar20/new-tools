import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { WebSocketClientComponent } from './websocket-client';

describe('WebSocketClientComponent', () => {
  let component: WebSocketClientComponent;
  let fixture: ComponentFixture<WebSocketClientComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebSocketClientComponent],
      providers: ddToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(WebSocketClientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
