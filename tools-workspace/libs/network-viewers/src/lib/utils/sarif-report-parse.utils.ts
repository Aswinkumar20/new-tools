import type {
  SarifDataset,
  SarifLevelStat,
  SarifLocationStat,
  SarifResult,
  SarifRuleStat,
  SarifSourceKind
} from '../types/sarif-report-viewer.types';

const LEVEL_RANK: Record<string, number> = { error: 3, warning: 2, note: 1, none: 0 };

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function textOf(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && 'text' in (value as object)) return asString((value as { text?: unknown }).text);
  return String(value).trim();
}

export function normalizeSarifLevel(raw: string): string {
  const v = raw.toLowerCase();
  if (['error', 'err', 'critical', 'high'].includes(v)) return 'error';
  if (['warning', 'warn', 'medium'].includes(v)) return 'warning';
  if (['note', 'info', 'informational', 'low', 'hint'].includes(v)) return 'note';
  if (v === 'none') return 'none';
  return v || 'warning';
}

function finishDataset(
  name: string,
  sourceKind: SarifSourceKind,
  version: string,
  tool: string,
  results: SarifResult[],
  ruleMeta: Map<string, { name: string; level: string; description: string }>,
  warnings: string[]
): SarifDataset {
  const ruleMap = new Map<string, SarifRuleStat>();
  const locMap = new Map<string, SarifLocationStat>();
  const levelMap = new Map<string, SarifLevelStat>();
  for (const r of results) {
    const meta = ruleMeta.get(r.ruleId);
    if (meta) {
      if (!r.ruleName) r.ruleName = meta.name;
      if (!r.level || r.level === 'warning') {
        /* keep result level */
      }
    }
    const rec =
      ruleMap.get(r.ruleId) ??
      {
        id: r.ruleId,
        name: r.ruleName || meta?.name || r.ruleId,
        level: r.level || meta?.level || 'warning',
        count: 0,
        description: meta?.description || ''
      };
    rec.count += 1;
    if (!rec.name && r.ruleName) rec.name = r.ruleName;
    ruleMap.set(r.ruleId, rec);
    const file = r.file || '(no file)';
    const loc = locMap.get(file) ?? { file, count: 0 };
    loc.count += 1;
    locMap.set(file, loc);
    const lvl = levelMap.get(r.level) ?? { name: r.level, count: 0 };
    lvl.count += 1;
    levelMap.set(r.level, lvl);
  }
  if (!results.length) warnings.push('SARIF report contains no results.');
  return {
    name,
    sourceKind,
    version,
    tool,
    results,
    rules: [...ruleMap.values()].sort((a, b) => (LEVEL_RANK[b.level] ?? 0) - (LEVEL_RANK[a.level] ?? 0) || b.count - a.count),
    locations: [...locMap.values()].sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)),
    levels: [...levelMap.values()].sort((a, b) => (LEVEL_RANK[b.name] ?? 0) - (LEVEL_RANK[a.name] ?? 0)),
    warnings
  };
}

function parseSarifDocument(data: Record<string, unknown>): SarifDataset {
  const runs = Array.isArray(data.runs) ? data.runs : [];
  if (!runs.length && !Array.isArray(data.results)) throw new Error('SARIF JSON is missing runs or results');
  const warnings: string[] = [];
  const ruleMeta = new Map<string, { name: string; level: string; description: string }>();
  const results: SarifResult[] = [];
  let toolName = '';
  const version = asString(data.version, '2.1.0');

  const ingestRun = (run: Record<string, unknown>, toolFallback: string) => {
    const toolObj = run.tool && typeof run.tool === 'object' ? (run.tool as Record<string, unknown>) : {};
    const driver = toolObj.driver && typeof toolObj.driver === 'object' ? (toolObj.driver as Record<string, unknown>) : {};
    const tool = asString(driver.name ?? toolObj.name, toolFallback);
    if (!toolName) toolName = tool;
    const rules = Array.isArray(driver.rules) ? driver.rules : Array.isArray(run.rules) ? run.rules : [];
    rules.forEach((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const id = asString(row.id);
      if (!id) return;
      const cfg = row.defaultConfiguration && typeof row.defaultConfiguration === 'object' ? (row.defaultConfiguration as Record<string, unknown>) : {};
      ruleMeta.set(id, {
        name: asString(row.name, id),
        level: normalizeSarifLevel(asString(cfg.level, 'warning')),
        description: textOf(row.shortDescription ?? row.fullDescription ?? row.help)
      });
    });
    const runResults = Array.isArray(run.results) ? run.results : [];
    runResults.forEach((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const locs = Array.isArray(row.locations) ? row.locations : [];
      const loc0 = locs[0] && typeof locs[0] === 'object' ? (locs[0] as Record<string, unknown>) : {};
      const phys = loc0.physicalLocation && typeof loc0.physicalLocation === 'object' ? (loc0.physicalLocation as Record<string, unknown>) : loc0;
      const artifact = phys.artifactLocation && typeof phys.artifactLocation === 'object' ? (phys.artifactLocation as Record<string, unknown>) : {};
      const region = phys.region && typeof phys.region === 'object' ? (phys.region as Record<string, unknown>) : {};
      const snippet = region.snippet && typeof region.snippet === 'object' ? (region.snippet as Record<string, unknown>) : {};
      const ruleId = asString(row.ruleId ?? row.rule, 'unknown');
      const meta = ruleMeta.get(ruleId);
      results.push({
        id: `s-${results.length + 1}`,
        index: results.length,
        ruleId,
        ruleName: meta?.name || asString(row.ruleName, ruleId),
        level: normalizeSarifLevel(asString(row.level, meta?.level || 'warning')),
        message: textOf(row.message),
        file: asString(artifact.uri ?? row.file ?? row.uri),
        startLine: asNumber(region.startLine ?? row.startLine ?? row.line),
        startColumn: asNumber(region.startColumn ?? row.startColumn ?? row.column),
        endLine: asNumber(region.endLine ?? row.endLine),
        snippet: textOf(snippet.text ?? region.snippet ?? row.snippet),
        tool
      });
    });
  };

  if (runs.length) {
    runs.forEach((run) => ingestRun((run && typeof run === 'object' ? run : {}) as Record<string, unknown>, 'SARIF tool'));
  } else {
    ingestRun(data, asString(data.tool, 'SARIF tool'));
  }

  if (!results.length) throw new Error('SARIF report contains no results');
  return finishDataset(toolName ? `${toolName} SARIF` : 'SARIF snapshot', 'sarif', version, toolName || 'SARIF tool', results, ruleMeta, warnings);
}

function parseFlatJson(data: Record<string, unknown>): SarifDataset {
  const raw = Array.isArray(data.results) ? data.results : Array.isArray(data.findings) ? data.findings : null;
  if (!raw) throw new Error('SARIF JSON is missing results');
  const ruleMeta = new Map<string, { name: string; level: string; description: string }>();
  const extraRules = Array.isArray(data.rules) ? data.rules : [];
  extraRules.forEach((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const id = asString(row.id ?? row.ruleId);
    if (!id) return;
    ruleMeta.set(id, {
      name: asString(row.name, id),
      level: normalizeSarifLevel(asString(row.level, 'warning')),
      description: asString(row.description)
    });
  });
  const tool = asString(data.tool ?? data.name, 'SARIF snapshot');
  const results: SarifResult[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const ruleId = asString(row.ruleId ?? row.rule, 'unknown');
    const meta = ruleMeta.get(ruleId);
    return {
      id: asString(row.id, `s-${i + 1}`),
      index: i,
      ruleId,
      ruleName: asString(row.ruleName ?? meta?.name, ruleId),
      level: normalizeSarifLevel(asString(row.level, meta?.level || 'warning')),
      message: textOf(row.message ?? row.synopsis),
      file: asString(row.file ?? row.uri ?? row.path),
      startLine: asNumber(row.startLine ?? row.line),
      startColumn: asNumber(row.startColumn ?? row.column),
      endLine: asNumber(row.endLine),
      snippet: asString(row.snippet),
      tool
    };
  });
  return finishDataset(tool, 'json', asString(data.version, ''), tool, results, ruleMeta, []);
}

function parseCsvSarif(text: string): SarifDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('SARIF CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const ruleI = idx('ruleid') >= 0 ? idx('ruleid') : idx('rule_id') >= 0 ? idx('rule_id') : idx('rule');
  const msgI = idx('message') >= 0 ? idx('message') : idx('msg');
  if (ruleI < 0 || msgI < 0) throw new Error('SARIF CSV needs ruleId and message columns');
  const levelI = idx('level') >= 0 ? idx('level') : idx('severity');
  const fileI = idx('file') >= 0 ? idx('file') : idx('uri') >= 0 ? idx('uri') : idx('path');
  const lineI = idx('line') >= 0 ? idx('line') : idx('startline') >= 0 ? idx('startline') : idx('start_line');
  const results: SarifResult[] = rows.slice(1).map((row, i) => ({
    id: `s-${i + 1}`,
    index: i,
    ruleId: row[ruleI] || 'unknown',
    ruleName: row[ruleI] || 'unknown',
    level: normalizeSarifLevel(levelI >= 0 ? row[levelI] || 'warning' : 'warning'),
    message: row[msgI] || '',
    file: fileI >= 0 ? row[fileI] || '' : '',
    startLine: lineI >= 0 && row[lineI] ? Number(row[lineI]) : null,
    startColumn: null,
    endLine: null,
    snippet: '',
    tool: 'CSV'
  }));
  return finishDataset('SARIF CSV', 'csv', '', 'CSV', results, new Map(), []);
}

export function parseSarifText(text: string, fileName = ''): SarifDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('SARIF report is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid SARIF JSON');
    }
    if (!data || typeof data !== 'object') throw new Error('SARIF JSON must be an object');
    const rec = data as Record<string, unknown>;
    if (Array.isArray(rec.runs) || rec.version || rec.$schema) return parseSarifDocument(rec);
    return parseFlatJson(rec);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (trimmed.includes(',') && /rule/i.test(trimmed.split('\n')[0] || '') && /message/i.test(trimmed.split('\n')[0] || ''))) {
    return parseCsvSarif(trimmed);
  }
  throw new Error('No SARIF results found — use .sarif, JSON, or CSV');
}

export function parseSarifBytes(bytes: Uint8Array, fileName = ''): SarifDataset {
  if (!bytes.length) throw new Error('SARIF report is empty');
  return parseSarifText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterSarifResults(results: SarifResult[], query: string): SarifResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return results;
  const tokens = q.split(/\s+/).filter(Boolean);
  return results.filter((r) =>
    tokens.every((token) => {
      if (['error', 'warning', 'note', 'none'].includes(token)) return r.level === token;
      if (token === 'rule' || token === 'file' || token === 'tool') return true;
      if (token.startsWith('rule:')) return r.ruleId.toLowerCase().includes(token.slice(5)) || r.ruleName.toLowerCase().includes(token.slice(5));
      if (token.startsWith('file:')) return r.file.toLowerCase().includes(token.slice(5));
      if (token.startsWith('tool:')) return r.tool.toLowerCase().includes(token.slice(5));
      const hay = `${r.ruleId} ${r.ruleName} ${r.level} ${r.message} ${r.file} ${r.snippet} ${r.tool} ${r.startLine ?? ''}`.toLowerCase();
      return hay.includes(token);
    })
  );
}

export function filterSarifRules(rules: SarifRuleStat[], query: string): SarifRuleStat[] {
  const q = query.trim().toLowerCase();
  if (!q) return rules;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rules.filter((r) =>
    tokens.every((token) => {
      if (['error', 'warning', 'note', 'none'].includes(token)) return r.level === token;
      if (token.startsWith('rule:')) return r.id.toLowerCase().includes(token.slice(5)) || r.name.toLowerCase().includes(token.slice(5));
      return `${r.id} ${r.name} ${r.level} ${r.description}`.toLowerCase().includes(token);
    })
  );
}

export function filterSarifLocations(locations: SarifLocationStat[], query: string): SarifLocationStat[] {
  const q = query.trim().toLowerCase();
  if (!q) return locations;
  const tokens = q.split(/\s+/).filter(Boolean);
  return locations.filter((loc) =>
    tokens.every((token) => {
      if (token.startsWith('file:')) return loc.file.toLowerCase().includes(token.slice(5));
      return loc.file.toLowerCase().includes(token);
    })
  );
}
