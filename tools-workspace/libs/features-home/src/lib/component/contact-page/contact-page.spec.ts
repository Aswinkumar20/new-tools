import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ContactPageComponent } from './contact-page';
import { CONTACT_EMAIL, CONTACT_TOPICS } from '../../constants/contact-page.constants';

describe('ContactPageComponent', () => {
  let component: ContactPageComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ContactPageComponent],
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'browser' }],
    });

    component = TestBed.createComponent(ContactPageComponent).componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose contact topics and email', () => {
    const exposed = component as unknown as {
      topics: typeof CONTACT_TOPICS;
      contactEmail: string;
    };

    expect(exposed.topics).toEqual(CONTACT_TOPICS);
    expect(exposed.contactEmail).toBe(CONTACT_EMAIL);
  });

  it('should validate email before opening mail client', () => {
    const exposed = component as unknown as {
      email: string;
      message: string;
      formError: { set: (value: string) => void };
      submitContact: (event: Event) => void;
    };

    const errorSpy = jest.fn();
    exposed.formError = { set: errorSpy };
    exposed.email = 'not-an-email';
    exposed.message = 'Hello';

    exposed.submitContact(new Event('submit'));

    expect(errorSpy).toHaveBeenCalledWith('That email address doesn’t look right.');
  });

  it('should report the selected topic label', () => {
    const exposed = component as unknown as {
      topicId: string;
      selectedTopicLabel: () => string;
    };

    exposed.topicId = 'tool';
    expect(exposed.selectedTopicLabel()).toBe('Request a tool');
  });
});
