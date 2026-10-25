import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { deriveConduits } from '../../model/conduits';
import { addZone, countRuleReferences, newId, removeZone, updateZone } from '../../model/ops';
import type { Zone } from '../../model/schema';
import { useProject } from '../../store/useProject';
import { Field, Section, Select, TextInput, Toggle } from '../form';
import { NetworksSection } from './NetworksSection';

const ZONE_COLORS = ['#0ea5e9', '#16a34a', '#8b5cf6', '#f59e0b', '#dc2626', '#64748b', '#db2777', '#0d9488'];
const SECURITY_LEVELS = [
  { value: '1', label: 'SL 1' },
  { value: '2', label: 'SL 2' },
  { value: '3', label: 'SL 3' },
  { value: '4', label: 'SL 4' },
] as const;

export function ProjectPanel() {
  const project = useProject((s) => s.project);
  const apply = useProject((s) => s.apply);
  const conduits = useMemo(() => deriveConduits(project), [project]);
  const zoneName = (id: string) => project.zones.find((z) => z.id === id)?.name ?? id;
  const patchZone = (id: string, p: Partial<Omit<Zone, 'id'>>) => apply((q) => updateZone(q, id, p));

  const createZone = () => {
    const zone: Zone = {
      id: newId('zone'),
      name: `Zone ${project.zones.length + 1}`,
      color: ZONE_COLORS[project.zones.length % ZONE_COLORS.length],
      trusted: true,
      targetSL: 2,
    };
    apply((q) => addZone(q, zone));
  };

  const deleteZone = (zone: Zone) => {
    const members = project.devices.filter((d) => d.zoneId === zone.id).length;
    const refs = countRuleReferences(project, 'zone', zone.id);
    const details = [
      members ? `${members} device(s) will be left without a zone.` : '',
      refs ? `${refs} firewall rule(s) refer to it and will be removed.` : '',
    ].filter(Boolean);
    if (details.length && !window.confirm(`Delete zone "${zone.name}"?\n\n${details.join('\n')}`)) return;
    apply((q) => removeZone(q, zone.id));
  };

  return (
    <>
      <Section title="Architecture">
        <Field label="Name">
          <TextInput value={project.name} onChange={(name) => apply((q) => ({ ...q, name }))} />
        </Field>
        <p className="stats">
          {project.devices.length} devices · {project.links.length} links · {project.flows.length} protocol flows
        </p>
        <p className="muted">Select a device, link or flow on the canvas to edit it.</p>
      </Section>

      <Section
        title="Security zones"
        actions={
          <button type="button" className="icon-button" onClick={createZone} title="Add zone">
            <Plus size={16} />
            <span>Zone</span>
          </button>
        }
      >
        {project.zones.length === 0 && <p className="empty">No zones yet. Zones group devices with shared security requirements.</p>}
        <ul className="zone-list">
          {project.zones.map((zone) => (
            <li key={zone.id} className="zone" style={{ borderLeftColor: zone.color }}>
              <div className="zone__row">
                <input
                  type="color"
                  value={zone.color}
                  aria-label={`Colour for ${zone.name}`}
                  onChange={(e) => patchZone(zone.id, { color: e.target.value })}
                />
                <TextInput value={zone.name} ariaLabel="Zone name" onChange={(name) => patchZone(zone.id, { name })} />
                <button type="button" className="icon-button danger" title="Delete zone" onClick={() => deleteZone(zone)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="zone__row">
                <Field label="Target level">
                  <Select
                    value={String(zone.targetSL) as '1' | '2' | '3' | '4'}
                    options={SECURITY_LEVELS}
                    onChange={(v) => patchZone(zone.id, { targetSL: Number(v) as Zone['targetSL'] })}
                  />
                </Field>
                <Toggle label="Trusted" checked={zone.trusted} onChange={(trusted) => patchZone(zone.id, { trusted })} />
                <span className="zone__count">{project.devices.filter((d) => d.zoneId === zone.id).length} devices</span>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <NetworksSection />

      <Section title="Conduits">
        <p className="muted">Zone pairs joined directly by a link or protocol flow.</p>
        {conduits.length === 0 && <p className="empty">No connections between zones.</p>}
        <ul className="conduit-list">
          {conduits.map((c) => (
            <li key={c.zones.join('|')}>
              <span>
                {zoneName(c.zones[0])} <span aria-hidden="true">↔</span> {zoneName(c.zones[1])}
              </span>
              <span className="muted">
                {c.linkIds.length} link{c.linkIds.length === 1 ? '' : 's'}, {c.flowIds.length} flow{c.flowIds.length === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
