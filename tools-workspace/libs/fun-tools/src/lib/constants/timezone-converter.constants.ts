import type { FtRelatedToolLink } from '../shared/ft-tool-suggestion.model';
import type { TimezoneOption } from '../types/timezone-converter.types';

export const TIMEZONE_CATALOG: ReadonlyArray<TimezoneOption> = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: 'UTC+0' },
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/-5' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/-6' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/-7' },
  { value: 'Europe/London', label: 'London (GMT)', offset: 'UTC+0/+1' },
  { value: 'Europe/Paris', label: 'Paris (CET)', offset: 'UTC+1/+2' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)', offset: 'UTC+1/+2' },
  { value: 'Europe/Rome', label: 'Rome (CET)', offset: 'UTC+1/+2' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)', offset: 'UTC+1/+2' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)', offset: 'UTC+1/+2' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)', offset: 'UTC+8' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', offset: 'UTC+8' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 'UTC+8' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 'UTC+4' },
  { value: 'Asia/Kolkata', label: 'Mumbai/New Delhi (IST)', offset: 'UTC+5:30' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', offset: 'UTC+10/+11' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)', offset: 'UTC+10/+11' },
  { value: 'America/Toronto', label: 'Toronto (EST)', offset: 'UTC-5/-4' },
  { value: 'America/Vancouver', label: 'Vancouver (PST)', offset: 'UTC-8/-7' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST)', offset: 'UTC-6/-5' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)', offset: 'UTC-3/-2' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)', offset: 'UTC-3' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', offset: 'UTC+2' },
  { value: 'Africa/Cairo', label: 'Cairo (EET)', offset: 'UTC+2/+3' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)', offset: 'UTC+9' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', offset: 'UTC+7' },
  { value: 'Asia/Jakarta', label: 'Jakarta (WIB)', offset: 'UTC+7' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)', offset: 'UTC+12/+13' }
];

export const TIMEZONE_DEFAULT_TARGET = 'UTC';

/** Absolute offset hours that suggest long-haul / meeting-buffer tooling. */
export const TIMEZONE_LARGE_DIFF_HOURS = 8;

export const TIMEZONE_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  {
    label: 'Stopwatch Timer',
    path: '/fun-tools/stopwatch-timer',
    description: 'Time meetings or handoffs across zones'
  },
  {
    label: 'Pomodoro Timer',
    path: '/fun-tools/pomodoro-timer',
    description: 'Schedule focused blocks that respect local hours'
  },
  {
    label: 'Random Number Generator',
    path: '/fun-tools/random-number-generator',
    description: 'Pick a fair meeting slot or order'
  },
  {
    label: 'Motivational Quote Generator',
    path: '/fun-tools/motivational-quote-generator',
    description: 'Kick off a remote standup with a quote'
  },
  {
    label: 'Coin Toss & Dice Roller',
    path: '/fun-tools/coin-toss-dice-roller',
    description: 'Decide who joins early when zones conflict'
  }
];
