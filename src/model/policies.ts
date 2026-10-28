// Company policy rules and switched-off built-in checks: the project's own security settings.
import { kindLabel } from './catalog';
import { newId } from './ops';
import { getProtocol } from './protocols';
import { levelLabel } from './purdue';
import type { Design, Device, PolicyRule, PolicySelector, Project } from './schema';

export function newPolicy(id = newId('policy')): PolicyRule {
  return {
    id,
    name: 'New policy rule',
    enabled: true,
    severity: 'medium',
    from: { kind: 'any' },
    to: { kind: 'any' },
    bothWays: false,
    connection: 'any',
    protocols: [],
  };
}

/** The example from the Rules tab: nothing in enterprise IT talks directly to the control levels. */
export function examplePolicy(id = newId('policy')): PolicyRule {
  return {
    ...newPolicy(id),
    name: 'No direct IT → OT',
    severity: 'high',
    from: { kind: 'levels', levels: [4, 5] },
    to: { kind: 'levels', levels: [0, 1, 2, 3] },
    bothWays: true,
  };
}

export function addPolicy(project: Project, rule: PolicyRule): Project {
  return { ...project, policies: [...project.policies, rule] };
}

export function updatePolicy(project: Project, id: string, patch: Partial<Omit<PolicyRule, 'id'>>): Project {
  return { ...project, policies: project.policies.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}

export function removePolicy(project: Project, id: string): Project {
  return { ...project, policies: project.policies.filter((r) => r.id !== id) };
}

export function setCheckEnabled(project: Project, checkId: string, enabled: boolean): Project {
  const off = project.disabledChecks.filter((c) => c !== checkId);
  return { ...project, disabledChecks: enabled ? off : [...off, checkId] };
}

export function selectorMatches(sel: PolicySelector, d: Device): boolean {
  switch (sel.kind) {
    case 'any':
      return true;
    case 'levels':
      return sel.levels.includes(d.purdueLevel);
    case 'zone':
      return d.zoneId === sel.id;
    case 'type':
      return sel.types.includes(d.type);
    case 'tag': {
      const tag = sel.tag.trim().toLowerCase();
      return d.tags.some((t) => t.toLowerCase() === tag);
    }
  }
}

/** "L4, L5", "zone Control", "PLC or RTU", "tag vendor-managed" or "any device". */
export function describeSelector(sel: PolicySelector, design: Design): string {
  switch (sel.kind) {
    case 'any':
      return 'any device';
    case 'levels':
      return [...sel.levels].sort((a, b) => b - a).map(levelLabel).join(', ');
    case 'zone':
      return `zone ${design.zones.find((z) => z.id === sel.id)?.name ?? sel.id}`;
    case 'type':
      return sel.types.map((t) => kindLabel(t, 'generic')).join(' or ');
    case 'tag':
      return `tag ${sel.tag}`;
  }
}

/** One line for lists and the change record, e.g. "L4, L5 ↔ L0, L1, L2, L3, flows: Modbus". */
export function describePolicy(rule: PolicyRule, design: Design): string {
  const arrow = rule.bothWays ? '↔' : '→';
  const what = rule.connection === 'link' ? 'links' : rule.connection === 'flow' ? 'flows' : 'links and flows';
  const protocols = rule.protocols.length ? `: ${rule.protocols.map((p) => getProtocol(p)?.label ?? p).join(', ')}` : '';
  return `${describeSelector(rule.from, design)} ${arrow} ${describeSelector(rule.to, design)}, ${what}${protocols}`;
}
