import { MarketingIconId } from '../types/marketing-icon.types';

export interface AboutStat {
  value: string;
  label: string;
  detail: string;
}

export interface AboutValue {
  title: string;
  description: string;
  icon: MarketingIconId;
}

export interface AboutStep {
  step: string;
  title: string;
  description: string;
  details: string[];
}

export interface AboutPrinciple {
  title: string;
  description: string;
}

export interface AboutAudience {
  title: string;
  description: string;
  examples: string[];
}

export interface AboutFaq {
  question: string;
  answer: string;
}

export interface AboutCompareRow {
  label: string;
  easytoolhub: string;
  typical: string;
}

export interface AboutMilestone {
  year: string;
  title: string;
  description: string;
}

export const ABOUT_HERO = {
  badge: '350+ tools · runs in your browser · free',
  title: 'Everyday tools in one place',
  lead:
    'EasyToolHub is a collection of converters, editors, viewers, and calculators you can use right in your browser. No install, no account, and no uploading a file just to do something that takes a minute.',
  note: 'I built it because I was tired of hunting for the same tools over and over.',
};

export const ABOUT_ORIGIN = {
  eyebrow: 'Why I built this',
  title: 'I got tired of opening ten tabs for one small job',
  paragraphs: [
    'It started with annoyance. I needed to merge a PDF, format some JSON, shrink an image, and preview a file — and every task sent me to a different website. Different layout every time. Pop-ups. Unclear privacy pages. Sometimes the file had to upload before I even knew if the tool would work.',
    'The job itself was always small. The hassle around it was not. I kept thinking: why isn’t there one simple site where I can search, pick a tool, and get on with my day?',
    'That’s what EasyToolHub is. Not a replacement for Photoshop or Excel — just a home for the quick stuff: convert a file, count words, decode a token, check a hash, preview something odd before you email it. The things you need often, but don’t want a whole app for.',
    'I added tools as I needed them, then as others asked for them. Each one stays focused: do one thing, load fast, say clearly when something won’t work in the browser, and keep your files on your machine when we can.',
  ],
  quote: '“If the task takes thirty seconds, the website shouldn’t waste five minutes of your time.”',
};

export const ABOUT_HOW_IT_WORKS = {
  eyebrow: 'How it works',
  title: 'Search, use, done',
  intro:
    'Nothing fancy. You find a tool, use it, copy or download the result. Same steps whether you’re fixing JSON, merging PDFs, or opening a file you’ve never seen before.',
  steps: [
    {
      step: '01',
      title: 'Find what you need',
      description:
        'Use the search bar on the home page, or browse by category if you know the area — PDF, text, images, developer tools, and so on.',
      details: [
        'Search looks at tool names and descriptions.',
        'Common categories are easy to reach from the home page.',
        'Every tool has its own page with the same header and layout.',
      ],
    },
    {
      step: '02',
      title: 'Add your input',
      description:
        'Paste text, pick a file, or change a few settings. Most tools run in your browser, so you usually see results straight away.',
      details: [
        'Counters and previews update as you type.',
        'Options are labelled plainly — no digging for “advanced” panels.',
        'If a file is too big or a format isn’t supported, the page says so.',
      ],
    },
    {
      step: '03',
      title: 'Copy or download',
      description:
        'Take the output and go. No signup step between you and the finished file.',
      details: [
        'Copy and download buttons are always easy to find.',
        'Need another tool? Search again — you’re still in the same site.',
        'Come back anytime. The basics don’t need an account.',
      ],
    },
    {
      step: '04',
      title: 'Come back next time',
      description:
        'When the next small job shows up, you already know where to look. One search bar instead of another round of Google results.',
      details: [
        'Navigation and search work the same on every page.',
        'New tools and categories get added over time.',
        'The layout stays familiar even as the list grows.',
      ],
    },
  ] satisfies AboutStep[],
};

export const ABOUT_MILESTONES: AboutMilestone[] = [
  {
    year: 'Start',
    title: 'Just for me',
    description: 'A handful of text, PDF, and data tools so I could ditch a messy bookmarks folder.',
  },
  {
    year: 'Later',
    title: 'More categories',
    description: 'Media, security, CAD, maps, science, dev tools — added as people asked or I hit the same need again.',
  },
  {
    year: 'Now',
    title: 'One site, many tools',
    description: 'Hundreds of tools behind one search. Still free, still mostly running in the browser.',
  },
];

export const ABOUT_STORY = {
  eyebrow: 'The point',
  title: 'Quick tools shouldn’t feel like work',
  paragraphs: [
    'Most of the time you don’t want a new app or a new account. You want to fix something and move on. EasyToolHub is built for that — open a page, do the thing, leave.',
    'Using the same layout everywhere helps too. You’re not relearning a new interface every time you click a link.',
  ],
};

export const ABOUT_AUDIENCES: AboutAudience[] = [
  {
    title: 'Students & writers',
    description: 'Word counts, format checks, file previews — before you hit submit.',
    examples: ['Word counter', 'Markdown preview', 'Unit converter'],
  },
  {
    title: 'Developers',
    description: 'Format JSON, decode JWTs, generate hashes — without installing another desktop app.',
    examples: ['JSON formatter', 'JWT decoder', 'Hash generator'],
  },
  {
    title: 'Anyone with files to fix',
    description: 'PDFs, images, audio clips, zip files — the everyday stuff that comes up at work or at home.',
    examples: ['Merge PDF', 'Image compressor', 'Archive viewer'],
  },
];

export const ABOUT_VALUES: AboutValue[] = [
  {
    icon: 'zap',
    title: 'Fast',
    description: 'Pages load quickly. Most work happens in the browser, so you’re not waiting on uploads.',
  },
  {
    icon: 'lock',
    title: 'Private when we can',
    description: 'For most tools, your file never leaves your device. We don’t ask for uploads just to rename a PDF.',
  },
  {
    icon: 'compass',
    title: 'Easy to browse',
    description: 'Tools are grouped by what you’re trying to do — convert, edit, view, calculate — so search usually gets you there in one go.',
  },
  {
    icon: 'accessibility',
    title: 'Readable',
    description: 'Clear type, keyboard-friendly controls, and light/dark themes so the site is usable on more screens.',
  },
  {
    icon: 'puzzle',
    title: 'One job per page',
    description: 'Each tool does one thing. No bloated menus, no “upgrade to export” on basic tasks.',
  },
  {
    icon: 'globe',
    title: 'Free',
    description: 'The main catalog stays free. No account required for normal use.',
  },
];

export const ABOUT_PRINCIPLES: AboutPrinciple[] = [
  {
    title: 'Browser first',
    description: 'When the browser can do the job, we use that — so your data often never hits our servers.',
  },
  {
    title: 'Say when it won’t work',
    description: 'Big files and odd formats have limits. We’d rather tell you upfront than waste your time.',
  },
  {
    title: 'Keep adding tools',
    description: 'Gaps in the catalog get filled over time, including niche file types and viewers.',
  },
  {
    title: 'Same look everywhere',
    description: 'Shared headers, spacing, and buttons so you’re not lost when you jump between tools.',
  },
];

export const ABOUT_COMPARE: AboutCompareRow[] = [
  {
    label: 'Getting started',
    easytoolhub: 'Open the page and start',
    typical: 'Sign up, confirm email, or install something',
  },
  {
    label: 'Your files',
    easytoolhub: 'Stay on your device for most tools',
    typical: 'Uploaded to someone else’s server',
  },
  {
    label: 'Next tool',
    easytoolhub: 'Search one site',
    typical: 'New tab, new site, new rules',
  },
  {
    label: 'Price',
    easytoolhub: 'Free for normal use',
    typical: 'Limits, watermarks, or paid exports',
  },
];

export const ABOUT_FAQS: AboutFaq[] = [
  {
    question: 'Do I need an account?',
    answer: 'No. Open a tool and use it. We don’t put a signup wall in front of the basics.',
  },
  {
    question: 'Do you upload my files?',
    answer:
      'For most tools, everything runs in your browser. If a tool works differently, we say so on that page.',
  },
  {
    question: 'Why does this site exist?',
    answer:
      'Because small tasks — convert, preview, format, check — shouldn’t mean hunting for a new random website every time.',
  },
  {
    question: 'Is it really free?',
    answer:
      'Yes. The tools are free to use. Keeping pages fast and doing work in the browser helps us keep it that way.',
  },
  {
    question: 'Which browsers work?',
    answer:
      'Recent Chrome, Firefox, Safari, and Edge are fine. Some heavy viewers need an up-to-date browser for WebAssembly or large files.',
  },
];

export const ABOUT_CTA = {
  title: 'Try a tool',
  text: 'Search the list or pick a category. Most pages open in a second or two.',
  primaryLabel: 'Browse all tools',
  secondaryLabel: 'PDF tools',
};

/** @deprecated Use ABOUT_HOW_IT_WORKS.steps */
export const ABOUT_STEPS = ABOUT_HOW_IT_WORKS.steps;
