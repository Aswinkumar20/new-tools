import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { PostmanLiteComponent } from './postman-lite';

describe('PostmanLiteComponent', () => {
  let component: PostmanLiteComponent;
  let fixture: ComponentFixture<PostmanLiteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostmanLiteComponent],
      providers: ddToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PostmanLiteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
