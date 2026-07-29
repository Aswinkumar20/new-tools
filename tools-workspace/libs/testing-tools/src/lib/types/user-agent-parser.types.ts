import type { FormControl, FormGroup } from '@angular/forms';

export type UserAgentDeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface ParsedUserAgent {
  raw: string;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: UserAgentDeviceType;
  engine: string | null;
  isBot: boolean;
}

export type UserAgentFormGroup = FormGroup<{
  userAgent: FormControl<string>;
  useCurrent: FormControl<boolean>;
}>;

export interface UserAgentFormValues {
  userAgent: string;
  useCurrent: boolean;
}

export interface UserAgentParseOutcome {
  parsed: ParsedUserAgent | null;
  errors: string[];
  warnings: string[];
}

export interface UserAgentSuggestionContext {
  hasInput: boolean;
  hasParsed: boolean;
  errorMessage: string | null;
  isBot: boolean;
  deviceType: UserAgentDeviceType | null;
  browser: string | null;
  os: string | null;
}
