import { Trash2 } from 'lucide-react';
import { removeArea, updateArea } from '../../model/structure';
import type { Area } from '../../model/schema';
import { NO_SELECTION, useProject } from '../../store/useProject';
import { Field, Section, TextInput, Toggle } from '../form';
import { DeviceIcon } from '../icons';

export function AreaInspector({ area }: { area: Area }) {
  const devices = useProject((s) => s.project.devices);
  const members = devices.filter((d) => d.areaId === area.id);
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const focusDevice = useProject((s) => s.focusDevice);
  const patch = (p: Partial<Omit<Area, 'id' | 'siteId'>>) =>
    apply((q) => updateArea(q, area.id, p), `area:${area.id}:${Object.keys(p).join(',')}`);

  return (
    <>
      <Section title="Area">
        <p className="muted">A cell, line or substation. Devices inside the frame belong to it and move with it.</p>
        <div className="zone__row">
          <input type="color" value={area.color} aria-label="Area colour" onChange={(e) => patch({ color: e.target.value })} />
          <Field label="Name">
            <TextInput value={area.name} onChange={(name) => patch({ name })} />
          </Field>
        </div>
        <Toggle label="Collapsed into a single node" checked={area.collapsed} onChange={(collapsed) => patch({ collapsed })} />
      </Section>
      <Section title={`Devices (${members.length})`}>
        {members.length === 0 && <p className="empty">Drag devices into the frame to add them.</p>}
        <ul className="member-list">
          {members.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => focusDevice(d.id)} disabled={area.collapsed} title={area.collapsed ? 'Expand the area to select its devices' : undefined}>
                <DeviceIcon type={d.type} variant={d.variant} size={20} />
                {d.label}
              </button>
            </li>
          ))}
        </ul>
      </Section>
      <div className="panel-actions">
        <button
          type="button"
          className="button danger"
          onClick={() => {
            apply((p) => removeArea(p, area.id));
            select(NO_SELECTION);
          }}
        >
          <Trash2 size={16} />
          Delete area (keep devices)
        </button>
      </div>
    </>
  );
}
