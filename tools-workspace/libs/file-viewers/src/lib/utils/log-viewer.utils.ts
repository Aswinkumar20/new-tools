import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  LOG_CHARTJS_CDN,
  LOG_LEVEL_COLORS,
  LOG_LEVEL_ICONS,
  LOG_MESSAGE_PREVIEW_MAX_CHARS
} from '../constants/log-viewer.constants';
import type { ChartJsConstructor, LogLevel, LogStats } from '../types/log-viewer.types';
import { LogLevel as LogLevelEnum } from '../types/log-viewer.types';

declare global {
  interface Window {
    Chart?: ChartJsConstructor;
  }
}

export function isValidLogFile(file: Pick<File, 'name' | 'type'>): boolean {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith('.log') || lowerName.endsWith('.txt') || file.type === 'text/plain';
}

export function getLogLevelClass(level: LogLevel): string {
  return `log-level-${level.toLowerCase()}`;
}

export function getLogLevelColor(level: LogLevel): string {
  return LOG_LEVEL_COLORS[level] || LOG_LEVEL_COLORS[LogLevelEnum.UNKNOWN];
}

export function getLogLevelIcon(level: LogLevel): string {
  return LOG_LEVEL_ICONS[level] || LOG_LEVEL_ICONS[LogLevelEnum.UNKNOWN];
}

export function formatLogTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

export function formatLogLevelPercentage(stats: LogStats | null, level: LogLevel): string {
  if (!stats || stats.total === 0) {
    return '0%';
  }
  return ((stats.byLevel[level] / stats.total) * 100).toFixed(1) + '%';
}

export function previewLogMessage(
  message: string,
  maxChars: number = LOG_MESSAGE_PREVIEW_MAX_CHARS
): string {
  if (message.length <= maxChars) {
    return message;
  }
  return message.slice(0, maxChars) + '...';
}

export function buildLogLevelChartConfig(stats: LogStats): unknown {
  const levelData = Object.entries(stats.byLevel)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => ({
      level: level as LogLevel,
      count
    }));

  return {
    type: 'bar',
    data: {
      labels: levelData.map((d) => d.level),
      datasets: [
        {
          label: 'Log Count',
          data: levelData.map((d) => d.count),
          backgroundColor: levelData.map((d) => getLogLevelColor(d.level)),
          borderColor: levelData.map((d) => getLogLevelColor(d.level)),
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  };
}

export async function loadChartJsLibrary(
  cdnUrl: string = LOG_CHARTJS_CDN
): Promise<ChartJsConstructor> {
  if (typeof window === 'undefined') {
    throw new TypeError('Chart.js can only be loaded in browser environment');
  }

  if (window.Chart) {
    return window.Chart;
  }

  const script = document.createElement('script');
  script.src = cdnUrl;
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const lib = window.Chart;
      if (!lib) {
        reject(new Error('Failed to load Chart.js library'));
        return;
      }
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Failed to load Chart.js library'));
  });
}

export function resolveLogSuggestion(options: {
  hasLogs: boolean;
  hasError: boolean;
  errorCount: number;
  regexEnabled: boolean;
  searchText: string;
}): FvToolSuggestion | null {
  const { hasLogs, hasError, errorCount, regexEnabled, searchText } = options;

  if (hasError) {
    return {
      id: 'lv-meta',
      title: 'Check the file type?',
      reason:
        'The file was rejected or failed to load. Confirm it is plain text (.log / .txt) before retrying.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasLogs) {
    return {
      id: 'lv-text',
      title: 'Have a plain text dump instead?',
      reason:
        'Some exports are .txt without log-level tokens. Preview them in Text File Viewer, then return here for filtering.',
      actionLabel: 'Open Text File Viewer',
      path: '/file-viewers/text-file-viewer'
    };
  }

  if (regexEnabled && searchText.trim()) {
    return {
      id: 'lv-regex',
      title: 'Need to refine that pattern?',
      reason:
        'Complex log searches are easier to prototype in Regex Tester before applying them here.',
      actionLabel: 'Open Regex Tester',
      path: '/text-utilities/regex-tester'
    };
  }

  if (errorCount > 0) {
    return {
      id: 'lv-diff',
      title: 'Comparing against a known-good run?',
      reason:
        'Error spikes often need a before/after diff. Compare two log exports with Text Difference.',
      actionLabel: 'Open Text Difference',
      path: '/text-utilities/text-difference'
    };
  }

  return {
    id: 'lv-json',
    title: 'Seeing structured JSON lines?',
    reason:
      'JSON logs read better when pretty-printed. Format selected payloads in JSON Formatter.',
    actionLabel: 'Open JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator'
  };
}
