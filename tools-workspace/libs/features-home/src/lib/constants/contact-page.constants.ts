import { MarketingIconId } from '../types/marketing-icon.types';

export interface ContactTopic {
  id: string;
  label: string;
  description: string;
  icon: MarketingIconId;
}

export interface ContactChannel {
  label: string;
  value: string;
  href: string;
  note: string;
  icon: MarketingIconId;
}

export interface ContactHighlight {
  label: string;
  value: string;
  icon: MarketingIconId;
}

export interface ContactFaq {
  question: string;
  answer: string;
}

export const CONTACT_EMAIL = 'hello@easytoolhub.com';

export const CONTACT_HERO = {
  badge: 'Contact',
  title: 'Get in touch',
  lead: 'Bug reports, tool ideas, or feedback — send a message and your email app opens ready to go.',
};

export const CONTACT_HIGHLIGHTS: ContactHighlight[] = [
  {
    label: 'Email',
    value: CONTACT_EMAIL,
    icon: 'mail',
  },
  {
    label: 'Reply time',
    value: 'Usually a few days',
    icon: 'message',
  },
  {
    label: 'Account',
    value: 'Not required',
    icon: 'lock',
  },
];

export const CONTACT_FORM = {
  nameLabel: 'Your name',
  namePlaceholder: 'Optional',
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  topicLabel: 'What is this about?',
  messageLabel: 'Message',
  messagePlaceholder: 'Tell me what happened, what you tried, or what you’d like to see added…',
  submitLabel: 'Open in your email app',
  helper:
    'Submitting opens your mail app with the message filled in. Nothing is stored on our servers.',
};

export const CONTACT_TOPICS: ContactTopic[] = [
  {
    id: 'bug',
    label: 'Report a bug',
    description: 'Something broken, wrong output, or a page that won’t load.',
    icon: 'bug',
  },
  {
    id: 'tool',
    label: 'Request a tool',
    description: 'A converter, viewer, or utility you couldn’t find here.',
    icon: 'plus-circle',
  },
  {
    id: 'feedback',
    label: 'General feedback',
    description: 'What works, what’s confusing, or what could be better.',
    icon: 'message',
  },
  {
    id: 'other',
    label: 'Something else',
    description: 'Partnerships, press, or anything that doesn’t fit above.',
    icon: 'help-circle',
  },
];

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    label: 'Email',
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    note: 'Best for screenshots and longer messages.',
    icon: 'mail',
  },
  {
    label: 'Response time',
    value: 'Usually a few days',
    href: '',
    note: 'Bug reports and clear requests get priority.',
    icon: 'message',
  },
];

export const CONTACT_TIPS = [
  'Include the tool name and a link if you can.',
  'For bugs: browser name, what you clicked, and what you expected.',
  'For tool requests: the file type or job you’re trying to do.',
];

export const CONTACT_FAQS: ContactFaq[] = [
  {
    question: 'Do you reply to every message?',
    answer:
      'I try to. Volume varies, but bug reports and clear requests usually get a reply within a few days.',
  },
  {
    question: 'Can I ask for a new tool?',
    answer:
      'Yes. I can’t promise every request, but the catalog grew from real needs — yours might be next.',
  },
  {
    question: 'Should I attach files?',
    answer:
      'Email works best for screenshots or small samples. Don’t send sensitive personal data unless you’re comfortable sharing it.',
  },
  {
    question: 'Is there a public issue tracker?',
    answer:
      'Not yet. Email is the main channel for now. If that changes, this page will be updated.',
  },
];

export const CONTACT_CTA = {
  title: 'Rather just use a tool?',
  text: 'Jump back to the catalog — most pages open in a second or two.',
  primaryLabel: 'Browse all tools',
  secondaryLabel: 'About EasyToolHub',
};
