import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarketingIconComponent } from '../marketing-icon/marketing-icon';
import {
  CONTACT_CTA,
  CONTACT_EMAIL,
  CONTACT_FAQS,
  CONTACT_FORM,
  CONTACT_HERO,
  CONTACT_HIGHLIGHTS,
  CONTACT_TIPS,
  CONTACT_TOPICS,
  ContactTopic,
} from '../../constants/contact-page.constants';

@Component({
  selector: 'lib-contact-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, MarketingIconComponent],
  templateUrl: './contact-page.html',
  styleUrl: './contact-page.scss',
})
export class ContactPageComponent implements AfterViewInit {
  private readonly cdr = inject(ChangeDetectorRef);
  protected pageReady = false;
  protected readonly hero = CONTACT_HERO;
  protected readonly highlights = CONTACT_HIGHLIGHTS;
  protected readonly formCopy = CONTACT_FORM;
  protected readonly topics = CONTACT_TOPICS;
  protected readonly tips = CONTACT_TIPS;
  protected readonly faqs = CONTACT_FAQS;
  protected readonly cta = CONTACT_CTA;
  protected readonly contactEmail = CONTACT_EMAIL;

  protected name = '';
  protected email = '';
  protected topicId = CONTACT_TOPICS[0]?.id ?? 'feedback';
  protected message = '';
  protected readonly formError = signal('');

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.pageReady = true;
      return;
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        this.pageReady = true;
        this.cdr.markForCheck();
      });
    } else {
      this.pageReady = true;
    }
  }

  protected selectTopic(topic: ContactTopic): void {
    this.topicId = topic.id;
    this.formError.set('');
  }

  protected selectedTopic(): ContactTopic | undefined {
    return CONTACT_TOPICS.find((topic) => topic.id === this.topicId);
  }

  protected selectedTopicLabel(): string {
    return this.selectedTopic()?.label ?? 'Contact';
  }

  protected isTopicSelected(topicId: string): boolean {
    return this.topicId === topicId;
  }

  protected submitContact(event: Event): void {
    event.preventDefault();
    this.formError.set('');

    const trimmedEmail = this.email.trim();
    const trimmedMessage = this.message.trim();

    if (!trimmedEmail) {
      this.formError.set('Please add your email so I can reply.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      this.formError.set('That email address doesn’t look right.');
      return;
    }

    if (!trimmedMessage) {
      this.formError.set('Please write a short message.');
      return;
    }

    const topicLabel =
      CONTACT_TOPICS.find((topic) => topic.id === this.topicId)?.label ?? 'Contact';
    const subject = `[EasyToolHub] ${topicLabel}`;
    const bodyLines = [
      this.name.trim() ? `Name: ${this.name.trim()}` : null,
      `Email: ${trimmedEmail}`,
      `Topic: ${topicLabel}`,
      '',
      trimmedMessage,
    ].filter((line): line is string => line !== null);

    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

    if (isPlatformBrowser(this.platformId)) {
      globalThis.location.href = mailto;
    }
  }
}
