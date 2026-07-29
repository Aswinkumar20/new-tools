import type { TtRelatedToolLink } from '../shared/tt-tool-suggestion.model';
import type { UserAgentFormValues } from '../types/user-agent-parser.types';

export const USER_AGENT_DEFAULT_FORM: UserAgentFormValues = {
  userAgent: '',
  useCurrent: true
};

export const USER_AGENT_EMPTY_ERROR = 'Enter a user agent string to parse.';

export const USER_AGENT_RELATED_TOOLS: ReadonlyArray<TtRelatedToolLink> = [
  {
    label: 'HTTP Header Decoder',
    path: '/dev-design-tools/http-header-decoder',
    description: 'Decode full request headers including User-Agent and Accept-*'
  },
  {
    label: 'Email / URL / IP Checker',
    path: '/testing-tools/email-url-ip-checker',
    description: 'Validate URLs and IPs found in logs next to UA strings'
  },
  {
    label: 'Viewport Size Detector',
    path: '/dev-design-tools/viewport-size-detector',
    description: 'Compare parsed device type with the live viewport'
  },
  {
    label: 'Screen Resolution Info',
    path: '/browser-utils/screen-resolution-info',
    description: 'Inspect display metrics for the current browser'
  }
];
