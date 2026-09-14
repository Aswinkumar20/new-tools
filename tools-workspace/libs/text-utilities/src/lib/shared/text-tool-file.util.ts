/** Returns true when the file is likely plain text or source code. */
export function isLikelyTextUploadFile(file: File): boolean {
  const blockedTypes = [
    'image/',
    'video/',
    'audio/',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
  ];
  if (file.type && blockedTypes.some((prefix) => file.type.startsWith(prefix) || file.type === prefix)) {
    return false;
  }
  if (!file.type || file.type.startsWith('text/')) {
    return true;
  }
  const allowedTypes = new Set([
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-yaml',
    'application/yaml',
    'application/csv',
    'application/rtf',
    'application/octet-stream',
  ]);
  if (allowedTypes.has(file.type)) {
    return true;
  }
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const textExtensions = new Set([
    'txt', 'text', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm', 'log',
    'yaml', 'yml', 'rtf', 'tsv', 'ini', 'cfg', 'conf', 'js', 'ts', 'css', 'scss',
    'py', 'java', 'go', 'rs', 'rb', 'php', 'sql',
  ]);
  return textExtensions.has(ext);
}
