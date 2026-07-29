export enum TextFileType {
  TXT = 'txt',
  LOG = 'log',
  MD = 'md',
  JSON = 'json',
  XML = 'xml',
  YAML = 'yaml',
  YML = 'yml',
  INI = 'ini',
  CFG = 'cfg',
  CONFIG = 'config',
  CSV = 'csv',
  RTF = 'rtf',
  HTML = 'html',
  HTM = 'htm',
  CSS = 'css',
  JS = 'js',
  TS = 'ts',
  PY = 'py',
  SH = 'sh',
  BAT = 'bat',
  PS1 = 'ps1',
  UNSUPPORTED = 'unsupported'
}

export interface TextFile {
  name: string;
  file: File;
  url: string;
  size: number;
  content: string;
  lines: number;
  fileType: TextFileType;
  encoding: string;
}

export interface TextFileValidationResult {
  validFiles: File[];
  errors: string[];
}
