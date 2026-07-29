import type { TtToolSuggestion } from '../shared/tt-tool-suggestion.model';
import { USER_AGENT_EMPTY_ERROR } from '../constants/user-agent-parser.constants';
import type {
  ParsedUserAgent,
  UserAgentParseOutcome,
  UserAgentSuggestionContext
} from '../types/user-agent-parser.types';

export function extractUserAgentVersion(ua: string, regex: RegExp): string | null {
  const match = ua.match(regex);
  return match && match[1] ? match[1] : null;
}

export function parseUserAgentString(ua: string): ParsedUserAgent {
  const isBot =
    /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|curl|wget|postman/i.test(ua) ||
    /headlesschrome/i.test(ua);

  let browser: string | null = null;
  let browserVersion: string | null = null;

  if (/edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
    browserVersion = extractUserAgentVersion(ua, /edg\/([\d.]+)/i);
  } else if (/chrome\/|crios\//i.test(ua) && !/chromium/i.test(ua)) {
    browser = 'Chrome';
    browserVersion = extractUserAgentVersion(ua, /(?:chrome|crios)\/([\d.]+)/i);
  } else if (/safari\//i.test(ua) && !/chrome|crios|edg\//i.test(ua)) {
    browser = 'Safari';
    browserVersion = extractUserAgentVersion(ua, /version\/([\d.]+)/i);
  } else if (/firefox\/|fxios\//i.test(ua)) {
    browser = 'Firefox';
    browserVersion = extractUserAgentVersion(ua, /(?:firefox|fxios)\/([\d.]+)/i);
  } else if (/msie |trident\//i.test(ua)) {
    browser = 'Internet Explorer';
    browserVersion = extractUserAgentVersion(ua, /(?:msie |rv:)([\d.]+)/i);
  } else if (/opera|opr\//i.test(ua)) {
    browser = 'Opera';
    browserVersion = extractUserAgentVersion(ua, /(?:opera|opr)\/([\d.]+)/i);
  }

  let os: string | null = null;
  let osVersion: string | null = null;

  if (/windows nt/i.test(ua)) {
    os = 'Windows';
    osVersion = extractUserAgentVersion(ua, /windows nt ([\d.]+)/i);
  } else if (/android/i.test(ua)) {
    os = 'Android';
    osVersion = extractUserAgentVersion(ua, /android ([\d.]+)/i);
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
    const extractedIosVersion = extractUserAgentVersion(ua, /os ([\d_]+)/i);
    osVersion = extractedIosVersion ? extractedIosVersion.replace(/_/g, '.') : null;
  } else if (/mac os x/i.test(ua)) {
    os = 'macOS';
    const extractedMacVersion = extractUserAgentVersion(ua, /mac os x ([\d_]+)/i);
    osVersion = extractedMacVersion ? extractedMacVersion.replace(/_/g, '.') : null;
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  let deviceType: ParsedUserAgent['deviceType'] = 'unknown';
  if (/mobile/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/android|iphone|ipad|ipod/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/windows|macintosh|linux/i.test(ua)) {
    deviceType = 'desktop';
  }

  if (isBot) {
    deviceType = 'bot';
  }

  let engine: string | null = null;
  if (/applewebkit/i.test(ua)) {
    engine = 'WebKit';
  }
  if (/gecko\/\d/i.test(ua) && !/like gecko/i.test(ua)) {
    engine = engine ? `${engine} + Gecko` : 'Gecko';
  }
  if (/trident\/\d/i.test(ua)) {
    engine = 'Trident';
  }

  return {
    raw: ua,
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
    engine,
    isBot
  };
}

export function parseUserAgentInput(rawInput: string): UserAgentParseOutcome {
  const ua = rawInput.trim();
  if (!ua) {
    return {
      parsed: null,
      errors: [USER_AGENT_EMPTY_ERROR],
      warnings: []
    };
  }

  return {
    parsed: parseUserAgentString(ua),
    errors: [],
    warnings: []
  };
}

export function buildParsedUserAgentCopyText(parsed: ParsedUserAgent): string {
  return [
    `Browser: ${parsed.browser ?? 'Unknown'}${parsed.browserVersion ? ` (${parsed.browserVersion})` : ''}`,
    `OS: ${parsed.os ?? 'Unknown'}${parsed.osVersion ? ` (${parsed.osVersion})` : ''}`,
    `Engine: ${parsed.engine ?? 'Unknown'}`,
    `Device: ${parsed.deviceType}`,
    `Bot: ${parsed.isBot ? 'Yes' : 'No'}`,
    '',
    'Raw:',
    parsed.raw
  ].join('\n');
}

export function resolveUserAgentSuggestion(
  context: UserAgentSuggestionContext
): TtToolSuggestion | null {
  const { hasInput, hasParsed, errorMessage, isBot, deviceType, browser, os } = context;

  if (!hasInput) {
    return {
      id: 'uap-get-started',
      title: 'Parse a user agent?',
      reason:
        'Paste a UA from logs or click Current to inspect this browser. Detection is heuristic — verify critical cases.',
      actionLabel: 'Open HTTP Header Decoder',
      path: '/dev-design-tools/http-header-decoder'
    };
  }

  if (errorMessage === USER_AGENT_EMPTY_ERROR) {
    return {
      id: 'uap-empty',
      title: 'Nothing to parse yet',
      reason: 'Enter a user agent string, or load the current browser UA from the toolbar.',
      actionLabel: 'Open HTTP Header Decoder',
      path: '/dev-design-tools/http-header-decoder'
    };
  }

  if (hasParsed && isBot) {
    return {
      id: 'uap-bot',
      title: 'Bot-like user agent detected',
      reason:
        'Matchers include crawlers, curl/wget/postman, and HeadlessChrome. Cross-check with request headers if this matters for access control.',
      actionLabel: 'Open HTTP Header Decoder',
      path: '/dev-design-tools/http-header-decoder'
    };
  }

  if (hasParsed && (!browser || !os)) {
    return {
      id: 'uap-unknown',
      title: 'Incomplete browser or OS match',
      reason:
        'Heuristics could not confidently identify browser and/or OS. Compare with full headers or a known sample UA.',
      actionLabel: 'Open HTTP Header Decoder',
      path: '/dev-design-tools/http-header-decoder'
    };
  }

  if (hasParsed && (deviceType === 'mobile' || deviceType === 'tablet')) {
    return {
      id: 'uap-device',
      title: 'Mobile or tablet profile detected',
      reason:
        'Compare this UA-derived device type with the live viewport and screen metrics when debugging responsive bugs.',
      actionLabel: 'Open Viewport Size Detector',
      path: '/dev-design-tools/viewport-size-detector'
    };
  }

  if (hasParsed) {
    return {
      id: 'uap-parsed',
      title: 'User agent parsed',
      reason:
        'Next, decode related HTTP headers or validate URLs/IPs from the same request log line.',
      actionLabel: 'Open Email / URL / IP Checker',
      path: '/testing-tools/email-url-ip-checker'
    };
  }

  return {
    id: 'uap-ready',
    title: 'Ready to parse',
    reason: 'Click Parse or keep typing — results update as the string changes.',
    actionLabel: 'Open Screen Resolution Info',
    path: '/browser-utils/screen-resolution-info'
  };
}
