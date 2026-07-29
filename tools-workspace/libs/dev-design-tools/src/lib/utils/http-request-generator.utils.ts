import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import {
  HTTP_REQUEST_CODE_FORMATS,
  HTTP_REQUEST_HISTORY_LIMIT,
  HTTP_REQUEST_URL_PATTERN_LOOSE
} from '../constants/http-request-generator.constants';
import type {
  HttpRequestGeneratorInput,
  HttpRequestHeaderPair,
  HttpRequestHistoryEntry
} from '../types/http-request-generator.types';

export function buildHttpHeadersObject(
  headers: ReadonlyArray<HttpRequestHeaderPair>
): Record<string, string> {
  const headersObj: Record<string, string> = {};
  for (const header of headers) {
    if (header.key && header.value) {
      headersObj[header.key] = header.value;
    }
  }
  return headersObj;
}

export function escapeSingleQuotes(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function formatBodyForCode(body: string): string {
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed);
  } catch {
    return `'${escapeSingleQuotes(body)}'`;
  }
}

export function getCodeFormatLabel(value: string): string {
  const format = HTTP_REQUEST_CODE_FORMATS.find((item) => item.value === value);
  return format?.label || 'Fetch';
}

export function validateHttpRequestUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return 'URL is required.';
  }
  if (!HTTP_REQUEST_URL_PATTERN_LOOSE.test(trimmed)) {
    return 'URL must start with http:// or https://.';
  }
  return null;
}

export function generateFetchCode(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string
): string {
  let code = `fetch('${url}', {\n`;
  code += `  method: '${method}',\n`;

  if (Object.keys(headers).length > 0) {
    code += `  headers: {\n`;
    for (const [key, value] of Object.entries(headers)) {
      code += `    '${key}': '${value}',\n`;
    }
    code += `  },\n`;
  }

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    code += `  body: ${formatBodyForCode(body)},\n`;
  }

  code += `});`;
  return code;
}

export function generateAxiosCode(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string
): string {
  const methodLower = method.toLowerCase();
  let code = '';

  if (method === 'GET' || method === 'DELETE' || method === 'HEAD') {
    code += `axios.${methodLower}('${url}'`;
    if (Object.keys(headers).length > 0) {
      code += `, {\n  headers: {\n`;
      for (const [key, value] of Object.entries(headers)) {
        code += `    '${key}': '${value}',\n`;
      }
      code += `  }\n})`;
    } else {
      code += ')';
    }
  } else {
    code += `axios.${methodLower}('${url}'`;
    if (body) {
      code += `, ${formatBodyForCode(body)}`;
    } else {
      code += ', {}';
    }
    if (Object.keys(headers).length > 0) {
      code += `, {\n  headers: {\n`;
      for (const [key, value] of Object.entries(headers)) {
        code += `    '${key}': '${value}',\n`;
      }
      code += `  }\n})`;
    } else {
      code += ')';
    }
  }

  return code;
}

export function generateCurlCode(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string
): string {
  let code = `curl -X ${method}`;

  for (const [key, value] of Object.entries(headers)) {
    code += ` \\\n  -H '${key}: ${value}'`;
  }

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    const bodyStr = body.replace(/'/g, "'\\''");
    code += ` \\\n  -d '${bodyStr}'`;
  }

  code += ` \\\n  '${url}'`;

  return code;
}

export function generatePythonCode(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string
): string {
  let code = 'import requests\n\n';
  code += `response = requests.${method.toLowerCase()}('${url}'`;

  if (Object.keys(headers).length > 0) {
    code += `,\n    headers={\n`;
    for (const [key, value] of Object.entries(headers)) {
      code += `        '${key}': '${value}',\n`;
    }
    code += `    }`;
  }

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    if (Object.keys(headers).length > 0) {
      code += `,\n    data=${formatBodyForCode(body)}`;
    } else {
      code += `,\n    data=${formatBodyForCode(body)}`;
    }
  }

  code += `\n)`;
  return code;
}

export function generateNodeCode(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string
): string {
  let code = `const https = require('https');\n`;
  code += `const http = require('http');\n\n`;

  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return `// Invalid URL: ${url}\n`;
  }
  const protocol = urlObj.protocol === 'https:' ? 'https' : 'http';

  code += `const options = {\n`;
  code += `  hostname: '${escapeSingleQuotes(urlObj.hostname)}',\n`;
  if (urlObj.port) {
    code += `  port: ${urlObj.port},\n`;
  }
  code += `  path: '${escapeSingleQuotes(`${urlObj.pathname}${urlObj.search}`)}',\n`;
  code += `  method: '${method}',\n`;

  if (Object.keys(headers).length > 0) {
    code += `  headers: {\n`;
    for (const [key, value] of Object.entries(headers)) {
      code += `    '${escapeSingleQuotes(key)}': '${escapeSingleQuotes(value)}',\n`;
    }
    code += `  }\n`;
  }

  code += `};\n\n`;

  code += `const req = ${protocol}.request(options, (res) => {\n`;
  code += `  console.log(\`statusCode: \${res.statusCode}\`);\n`;
  code += `  res.on('data', (d) => {\n`;
  code += `    process.stdout.write(d);\n`;
  code += `  });\n`;
  code += `});\n\n`;

  if (body && !['GET', 'HEAD'].includes(method)) {
    code += `req.write(${formatBodyForCode(body)});\n`;
  }

  code += `req.end();`;

  return code;
}

export function generatePhpCode(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string
): string {
  let code = `$ch = curl_init();\n\n`;

  code += `curl_setopt($ch, CURLOPT_URL, '${url}');\n`;
  code += `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`;
  code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');\n`;

  if (Object.keys(headers).length > 0) {
    code += `curl_setopt($ch, CURLOPT_HTTPHEADER, [\n`;
    for (const [key, value] of Object.entries(headers)) {
      code += `    '${key}: ${value}',\n`;
    }
    code += `]);\n`;
  }

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    const bodyStr = body.replace(/'/g, "\\'");
    code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${bodyStr}');\n`;
  }

  code += `\n$response = curl_exec($ch);\n`;
  code += `curl_close($ch);\n`;
  code += `echo $response;`;

  return code;
}

export function generateHttpRequestCode(input: HttpRequestGeneratorInput): string {
  const headersObj = buildHttpHeadersObject(input.headers);
  const { url, method, body, codeFormat } = input;

  switch (codeFormat) {
    case 'fetch':
      return generateFetchCode(url, method, headersObj, body);
    case 'axios':
      return generateAxiosCode(url, method, headersObj, body);
    case 'curl':
      return generateCurlCode(url, method, headersObj, body);
    case 'python':
      return generatePythonCode(url, method, headersObj, body);
    case 'node':
      return generateNodeCode(url, method, headersObj, body);
    case 'php':
      return generatePhpCode(url, method, headersObj, body);
    default:
      return generateFetchCode(url, method, headersObj, body);
  }
}

export function formatRelativeTimestamp(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString();
}

export function prependHttpRequestHistory(
  entries: HttpRequestHistoryEntry[],
  entry: HttpRequestHistoryEntry,
  limit = HTTP_REQUEST_HISTORY_LIMIT
): HttpRequestHistoryEntry[] {
  const exists = entries.some(
    (existing) =>
      existing.url === entry.url &&
      existing.method === entry.method &&
      existing.codeFormat === entry.codeFormat
  );
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function resolveHttpRequestSuggestion(options: {
  url: string;
  method: string;
  headers: ReadonlyArray<HttpRequestHeaderPair>;
  body: string;
  hasCopiedCode: boolean;
}): DdToolSuggestion | null {
  const { url, method, headers, body, hasCopiedCode } = options;
  const auth = headers.find((header) => header.key.toLowerCase() === 'authorization');
  if (auth && /bearer\s+\S+/i.test(auth.value)) {
    return {
      id: 'hrg-jwt',
      title: 'Decode the Bearer token first?',
      reason: 'Authorization looks like a JWT. Inspect claims before shipping this request snippet.',
      actionLabel: 'Open JWT Decoder',
      path: '/testing-tools/jwt-decoder'
    };
  }

  const hasCorsHeader = headers.some((header) =>
    header.key.toLowerCase().startsWith('access-control-')
  );
  if (hasCorsHeader || hasCopiedCode) {
    return {
      id: 'hrg-cors',
      title: 'Test CORS against this URL?',
      reason: 'Browser clients often fail on Access-Control rules. Verify the endpoint before integrating the snippet.',
      actionLabel: 'Open CORS Test Tool',
      path: '/dev-design-tools/cors-test-tool'
    };
  }

  const contentType = headers.find((header) => header.key.toLowerCase() === 'content-type');
  const bodyLooksJson =
    !!body.trim() &&
    (body.trim().startsWith('{') || body.trim().startsWith('[')) &&
    (method === 'POST' || method === 'PUT' || method === 'PATCH');
  if (bodyLooksJson || (contentType && /json/i.test(contentType.value) && body.trim())) {
    return {
      id: 'hrg-json',
      title: 'Validate the JSON body?',
      reason: 'Pretty-print and lint the payload so generated clients send well-formed JSON.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (headers.length > 1 || headers.some((header) => header.key && header.key.toLowerCase() !== 'content-type')) {
    return {
      id: 'hrg-headers',
      title: 'Review these headers in the decoder?',
      reason: 'HTTP Header Decoder categorizes and documents each header before you finalize the snippet.',
      actionLabel: 'Open HTTP Header Decoder',
      path: '/dev-design-tools/http-header-decoder'
    };
  }

  return null;
}
