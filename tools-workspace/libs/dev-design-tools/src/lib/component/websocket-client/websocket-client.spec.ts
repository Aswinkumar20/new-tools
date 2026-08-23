import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WebsocketClientComponent } from './websocket-client';

describe('WebsocketClientComponent', () => {
  let component: WebsocketClientComponent;
  let fixture: ComponentFixture<WebsocketClientComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebsocketClientComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(WebsocketClientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
