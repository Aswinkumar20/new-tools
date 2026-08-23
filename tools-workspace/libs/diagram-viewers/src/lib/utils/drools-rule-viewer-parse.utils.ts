import type { DrlCondition, DrlDataset, DrlRule, DrlSourceKind } from '../types/drools-rule-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:rules|rulebase|rule|condition|when)\b/i.test(text);
}

function looksLikeDrl(text: string): boolean {
  return /rule\s+"[^"]+"|^\s*package\s+[\w.]+/m.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:drl|drools|xml|json|rules?)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) return { source: fence[1].trim(), fenced: true };
  return { source: text.trim(), fenced: false };
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

function slug(value: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'rule';
}

function upsertRule(
  rules: DrlRule[],
  next: { id?: string; name: string; salience?: string; agendaGroup?: string; whenText?: string; thenText?: string }
): DrlRule {
  const id = next.id || slug(next.name);
  const existing = rules.find((r) => r.id === id || r.name === next.name);
  if (existing) {
    if (next.salience) existing.salience = next.salience;
    if (next.agendaGroup) existing.agendaGroup = next.agendaGroup;
    if (next.whenText) existing.whenText = next.whenText;
    if (next.thenText) existing.thenText = next.thenText;
    return existing;
  }
  const created: DrlRule = {
    id,
    index: rules.length,
    name: next.name,
    salience: next.salience || '',
    agendaGroup: next.agendaGroup || '',
    whenText: next.whenText || '',
    thenText: next.thenText || '',
    x: 0,
    y: 0
  };
  rules.push(created);
  return created;
}

function addCondition(
  conditions: DrlCondition[],
  rule: DrlRule,
  factType: string,
  constraints: string,
  modifier = ''
): void {
  if (!factType && !constraints) return;
  if (
    conditions.some(
      (c) => c.ruleId === rule.id && c.factType === factType && c.constraints === constraints && c.modifier === modifier
    )
  ) {
    return;
  }
  conditions.push({
    id: `c-${conditions.length + 1}`,
    index: conditions.length,
    ruleId: rule.id,
    ruleName: rule.name,
    factType: factType || (modifier === 'eval' ? 'eval' : ''),
    constraints: constraints || '',
    modifier,
    x: 0,
    y: 0
  });
}

function parseWhenBlock(whenText: string, rule: DrlRule, conditions: DrlCondition[]): void {
  const text = whenText.trim();
  if (!text) return;
  const patternRe = /(?:(not|exists)\s+)?(?:\$[\w]+\s*:\s*)?([A-Za-z_][\w.]*)\s*\(([^)]*)\)|(eval)\s*\(([\s\S]*?)\)/gi;
  let match: RegExpExecArray | null;
  let found = false;
  while ((match = patternRe.exec(text))) {
    found = true;
    if (match[4]) {
      addCondition(conditions, rule, 'eval', (match[5] || '').trim(), 'eval');
      continue;
    }
    addCondition(conditions, rule, match[2], (match[3] || '').trim(), (match[1] || '').toLowerCase());
  }
  if (!found) addCondition(conditions, rule, '', text.replace(/\s+/g, ' '));
}

function layoutRules(rules: DrlRule[], conditions: DrlCondition[]): void {
  rules.forEach((r, i) => {
    r.x = 48;
    r.y = 40 + i * 140;
  });
  const byRule = new Map<string, DrlCondition[]>();
  for (const c of conditions) {
    const list = byRule.get(c.ruleId) ?? [];
    list.push(c);
    byRule.set(c.ruleId, list);
  }
  for (const r of rules) {
    const list = byRule.get(r.id) ?? [];
    list.forEach((c, j) => {
      c.x = 300;
      c.y = r.y + j * 44;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: DrlSourceKind,
  title: string,
  packageName: string,
  rules: DrlRule[],
  conditions: DrlCondition[],
  warnings: string[]
): DrlDataset {
  if (!rules.length) throw new Error('Drools file contains no rules');
  rules.forEach((r, i) => (r.index = i));
  conditions.forEach((c, i) => (c.index = i));
  layoutRules(rules, conditions);
  if (!conditions.length) warnings.push('No when-conditions found on these rules');
  return { name, sourceKind, title: title || name, packageName, rules, conditions, warnings };
}

function ingestRuleRow(rules: DrlRule[], conditions: DrlCondition[], row: Record<string, unknown>): void {
  const name = asString(row.name || row.id || row.title);
  if (!name) return;
  const whenText = asString(row.when || row.whenText || rec(row.lhs).text);
  const thenText = asString(row.then || row.thenText || row.action || rec(row.rhs).text);
  const rule = upsertRule(rules, {
    name,
    salience: asString(row.salience ?? rec(row.attributes).salience),
    agendaGroup: asString(row.agendaGroup || row['agenda-group'] || rec(row.attributes).agendaGroup),
    whenText,
    thenText
  });
  const condList = Array.isArray(row.conditions)
    ? row.conditions
    : Array.isArray(row.when)
      ? row.when
      : Array.isArray(rec(row.lhs).conditions)
        ? rec(row.lhs).conditions
        : [];
  if (Array.isArray(condList) && condList.length && typeof condList[0] !== 'string') {
    for (const item of condList) {
      const c = rec(item);
      addCondition(
        conditions,
        rule,
        asString(c.fact || c.factType || c.type || c.name),
        asString(c.constraints || c.constraint || c.expr || c.condition),
        asString(c.modifier || c.op)
      );
    }
  } else if (whenText) {
    parseWhenBlock(whenText, rule, conditions);
  }
}

function parseJson(raw: unknown, fileName: string): DrlDataset {
  const root = rec(Array.isArray(raw) ? { rules: raw } : raw);
  const name = asString(root.name || root.title, fileName.replace(/\.[^.]+$/, '') || 'Drools rules');
  const packageName = asString(root.package || root.packageName || rec(root.unit).package);
  const rules: DrlRule[] = [];
  const conditions: DrlCondition[] = [];
  const ruleList = Array.isArray(root.rules) ? root.rules : Array.isArray(root.rule) ? root.rule : [];
  for (const item of ruleList) ingestRuleRow(rules, conditions, rec(item));
  if (!rules.length) throw new Error('Drools JSON contains no rules');
  return finishDataset(name, 'json', asString(root.title || root.name, name), packageName, rules, conditions, []);
}

function parseXml(xml: string, fileName: string): DrlDataset {
  const rootTag = /<(?:rules|rulebase|rule-package)\b([^>]*)>/i.exec(xml);
  const ra = attrs(rootTag?.[1] || '');
  const name = ra.name || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Drools rules';
  const packageName = ra.package || ra.packagename || '';
  const rules: DrlRule[] = [];
  const conditions: DrlCondition[] = [];
  const ruleRe = /<(?:[\w.-]+:)?rule\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/(?:[\w.-]+:)?rule>/gi;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(xml))) {
    const a = attrs(match[1] || '');
    const inner = match[2] || '';
    const ruleName = a.name || a.id || '';
    if (!ruleName) continue;
    const thenM = /<(?:[\w.-]+:)?then\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?then>/i.exec(inner);
    const whenM = /<(?:[\w.-]+:)?when\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?when>/i.exec(inner);
    const rule = upsertRule(rules, {
      name: ruleName,
      salience: a.salience || '',
      agendaGroup: a['agenda-group'] || a.agendagroup || '',
      whenText: (whenM?.[1] || '').trim(),
      thenText: (thenM?.[1] || '').trim()
    });
    const condRe =
      /<(?:[\w.-]+:)?condition\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/>|<(?:[\w.-]+:)?condition\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/(?:[\w.-]+:)?condition>/gi;
    let cm: RegExpExecArray | null;
    let found = false;
    while ((cm = condRe.exec(inner))) {
      found = true;
      const ca = attrs(cm[1] || cm[2] || '');
      addCondition(conditions, rule, ca.fact || ca.type || ca.name || '', ca.constraints || ca.constraint || (cm[3] || '').trim(), ca.modifier || '');
    }
    if (!found && rule.whenText) parseWhenBlock(rule.whenText, rule, conditions);
  }
  if (!rules.length) throw new Error('Drools XML contains no rules');
  return finishDataset(name, 'xml', name, packageName, rules, conditions, []);
}

function parseDrl(text: string, fileName: string, sourceKind: DrlSourceKind): DrlDataset {
  const packageMatch = /package\s+([\w.]+)\s*;/.exec(text);
  const packageName = packageMatch?.[1] || '';
  const name = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Drools rules';
  const rules: DrlRule[] = [];
  const conditions: DrlCondition[] = [];
  const ruleRe = /rule\s+"([^"]+)"([\s\S]*?)when([\s\S]*?)then([\s\S]*?)end/gi;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(text))) {
    const header = match[2] || '';
    const salienceM = /salience\s+(-?\d+)/i.exec(header);
    const agendaM = /agenda-group\s+"([^"]+)"/i.exec(header);
    const rule = upsertRule(rules, {
      name: match[1],
      salience: salienceM?.[1] || '',
      agendaGroup: agendaM?.[1] || '',
      whenText: (match[3] || '').trim(),
      thenText: (match[4] || '').trim()
    });
    parseWhenBlock(rule.whenText, rule, conditions);
  }
  if (!rules.length) throw new Error('Drools DRL contains no rules');
  return finishDataset(name, sourceKind, name, packageName, rules, conditions, []);
}

function parseMarkdownList(text: string, fileName: string, sourceKind: DrlSourceKind): DrlDataset {
  const nameHeading = /^#\s+(.+)$/m.exec(text);
  const name = nameHeading?.[1].trim() || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Drools rules';
  const rules: DrlRule[] = [];
  const conditions: DrlCondition[] = [];
  if (looksLikeDrl(text)) {
    const parsed = parseDrl(text, fileName, sourceKind);
    return parsed;
  }
  const sections = text.split(/^##\s+/m).slice(1);
  if (sections.length) {
    for (const section of sections) {
      const lines = section.split(/\r?\n/);
      const ruleName = (lines[0] || '').trim();
      if (!ruleName) continue;
      const body = lines.slice(1).join('\n');
      const whenM = /when\s+([\s\S]*?)(?:then|$)/i.exec(body);
      const thenM = /then\s+([\s\S]*?)$/i.exec(body);
      const rule = upsertRule(rules, {
        name: ruleName,
        whenText: (whenM?.[1] || '').trim(),
        thenText: (thenM?.[1] || '').trim()
      });
      parseWhenBlock(rule.whenText, rule, conditions);
    }
  }
  if (!rules.length) throw new Error('Drools markdown contains no rules');
  return finishDataset(name, sourceKind, name, '', rules, conditions, []);
}

export function parseDroolsText(text: string, fileName = ''): DrlDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Drools file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Drools JSON');
    }
    return parseJson(parsed, fileName);
  }
  if ((looksLikeXml(raw) && /<(?:rules|rulebase|rule)\b/i.test(raw)) || (ext === 'xml' && looksLikeXml(raw))) {
    return parseXml(raw, fileName);
  }
  if (ext === 'drl' || looksLikeDrl(raw)) {
    return parseDrl(raw, fileName, ext === 'drl' ? 'drl' : /rule\s+"/.test(raw) ? 'drl' : ext === 'md' ? 'markdown' : 'txt');
  }
  const extracted = extractFence(raw);
  const sourceKind: DrlSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : 'txt';
  if (/^#+\s+/m.test(extracted.source) || /when\s+/i.test(extracted.source)) {
    return parseMarkdownList(extracted.source, fileName, sourceKind);
  }
  throw new Error('Not a Drools rule file');
}

export function parseDroolsBytes(bytes: Uint8Array, fileName = ''): DrlDataset {
  if (!bytes.length) throw new Error('Drools file is empty');
  return parseDroolsText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterDrlRules(rules: DrlRule[], query: string): DrlRule[] {
  const q = query.trim().toLowerCase();
  if (!q) return rules;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rules.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('rule:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return r.name.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('salience:')) return r.salience === token.slice(9);
      return `${r.id} ${r.name} ${r.salience} ${r.agendaGroup} ${r.whenText} ${r.thenText}`.toLowerCase().includes(token);
    })
  );
}

export function filterDrlConditions(conditions: DrlCondition[], query: string): DrlCondition[] {
  const q = query.trim().toLowerCase();
  if (!q) return conditions;
  const tokens = q.split(/\s+/).filter(Boolean);
  return conditions.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('fact:') || token.startsWith('type:')) return c.factType.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('rule:')) return c.ruleName.toLowerCase().includes(token.slice(5)) || c.ruleId.toLowerCase().includes(token.slice(5));
      if (token.startsWith('when:')) return c.constraints.toLowerCase().includes(token.slice(5));
      return `${c.ruleName} ${c.factType} ${c.constraints} ${c.modifier}`.toLowerCase().includes(token);
    })
  );
}
