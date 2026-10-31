// Exports attack paths in MITRE's Attack Flow format: a STIX 2.1 bundle that uses the Attack Flow
// extension (schema 2.0.0). Each path becomes a chain of attack-action objects, one per step plus
// the impact, all under one attack-flow with the "attack-tree" scope. Loaded on demand.
import { kindLabel } from '../catalog';
import { getProtocol } from '../protocols';
import { levelLabel } from '../purdue';
import type { Device, Project } from '../schema';
import { ATTACK_ICS_RELEASE, ICS_TACTICS, ICS_TECHNIQUES, type IcsTacticName, type IcsTechniqueId } from './icsTechniques';
import type { AttackPath } from './paths';

export const ATTACK_FLOW_EXTENSION_ID = 'extension-definition--fb9c968a-745b-4ade-9b25-c324172197f4';
const CTID_IDENTITY_ID = 'identity--d673f8cb-c168-42da-8ed4-0cb26725f86c';
const CREATED = '2022-08-02T19:34:35.143Z';

/** The extension definition and its author, as published in attack-flow-extension-2.0.0.json. */
export const EXTENSION_OBJECTS = [
  {
    type: 'extension-definition',
    id: ATTACK_FLOW_EXTENSION_ID,
    spec_version: '2.1',
    name: 'Attack Flow',
    description: 'Extends STIX 2.1 with features to create Attack Flows.',
    created: CREATED,
    modified: CREATED,
    created_by_ref: CTID_IDENTITY_ID,
    schema: 'https://center-for-threat-informed-defense.github.io/attack-flow/stix/attack-flow-schema-2.0.0.json',
    version: '2.0.0',
    extension_types: ['new-sdo'],
    external_references: [
      { source_name: 'Documentation', description: 'Documentation for Attack Flow', url: 'https://center-for-threat-informed-defense.github.io/attack-flow' },
      { source_name: 'GitHub', description: 'Source code repository for Attack Flow', url: 'https://github.com/center-for-threat-informed-defense/attack-flow' },
    ],
  },
  {
    type: 'identity',
    spec_version: '2.1',
    id: CTID_IDENTITY_ID,
    created_by_ref: CTID_IDENTITY_ID,
    created: CREATED,
    modified: CREATED,
    name: 'MITRE Center for Threat-Informed Defense',
    identity_class: 'organization',
  },
] as const;

export type StixObject = { type: string; id: string; [key: string]: unknown };
export interface StixBundle {
  type: 'bundle';
  id: string;
  objects: StixObject[];
}

export interface AttackFlowOptions {
  /** Makes ids; random version 4 UUIDs by default. Tests pass a counter. */
  uuid?: () => string;
  now?: Date;
}

/** A random version 4 UUID. Unlike crypto.randomUUID this also works outside secure contexts. */
function uuid4(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A STIX 2.1 bundle describing the given paths as one Attack Flow. */
export function toAttackFlow(project: Project, paths: readonly AttackPath[], options: AttackFlowOptions = {}): StixBundle {
  const uuid = options.uuid ?? uuid4;
  const now = (options.now ?? new Date()).toISOString();
  const device = new Map(project.devices.map((d) => [d.id, d]));
  const zone = new Map(project.zones.map((z) => [z.id, z.name]));
  const ext = { [ATTACK_FLOW_EXTENSION_ID]: { extension_type: 'new-sdo' } };
  const sdo = (type: string, props: Record<string, unknown>): StixObject => ({
    type,
    spec_version: '2.1',
    id: `${type}--${uuid()}`,
    created: now,
    modified: now,
    ...props,
  });
  const where = (d: Device) => `${kindLabel(d.type, d.variant)}, ${levelLabel(d.purdueLevel)}, ${d.zoneId ? `zone ${zone.get(d.zoneId) ?? d.zoneId}` : 'no zone'}`;

  const author = sdo('identity', { name: 'ReSecArc', identity_class: 'system', description: 'Generated from the architecture design.' });
  const assets = new Map<string, StixObject>();
  const assetFor = (d: Device) => {
    let a = assets.get(d.id);
    if (!a) assets.set(d.id, (a = sdo('attack-asset', { name: d.label || kindLabel(d.type, d.variant), description: where(d), extensions: ext })));
    return a.id;
  };
  const action = (tactic: IcsTacticName, technique: IcsTechniqueId, description: string, d: Device) =>
    sdo('attack-action', {
      name: ICS_TECHNIQUES[technique].name,
      technique_id: technique,
      tactic_id: ICS_TACTICS[tactic].id,
      description,
      asset_refs: [assetFor(d)],
      extensions: ext,
    });

  const actions: StixObject[] = [];
  const starts: string[] = [];
  for (const path of paths) {
    const chain = path.steps.map((s, i) => {
      const d = device.get(s.deviceId)!;
      const name = d.label || kindLabel(d.type, d.variant);
      if (i === 0) return action(s.tactic, s.technique, `Entry point: ${name} (${where(d)}).`, d);
      const prev = device.get(path.steps[i - 1].deviceId)!;
      const flow = s.viaFlowId ? project.flows.find((f) => f.id === s.viaFlowId) : undefined;
      const firewalls = s.viaDeviceIds.map((id) => device.get(id)!).filter((x) => x.type === 'firewall');
      const how = [
        flow ? ` over the ${getProtocol(flow.protocol)?.label ?? flow.protocol} flow` : '',
        firewalls.length ? ` through ${firewalls.map((x) => x.label).join(', ')}` : '',
      ].join('');
      return action(s.tactic, s.technique, `${name} (${where(d)}), reached from ${prev.label}${how}.`, d);
    });
    const target = device.get(path.targetId)!;
    chain.push(action(path.impact.tactic, path.impact.technique, `Possible impact at ${target.label} (${where(target)}).`, target));
    chain.forEach((a, i) => {
      if (i < chain.length - 1) a.effect_refs = [chain[i + 1].id];
    });
    starts.push(chain[0].id);
    actions.push(...chain);
  }

  const flow = sdo('attack-flow', {
    name: `${project.name || 'Architecture'}: possible attack paths`,
    description: `Possible attack paths based on the design, not predictions. Generated by ReSecArc and labelled with MITRE ATT&CK for ICS (${ATTACK_ICS_RELEASE}).`,
    scope: 'attack-tree',
    start_refs: starts,
    created_by_ref: author.id,
    external_references: [{ source_name: 'MITRE ATT&CK for ICS', description: ATTACK_ICS_RELEASE, url: 'https://attack.mitre.org/matrices/ics/' }],
    extensions: ext,
  });

  return { type: 'bundle', id: `bundle--${uuid()}`, objects: [...EXTENSION_OBJECTS, author, flow, ...actions, ...assets.values()] };
}
