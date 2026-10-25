import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Trash2,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { alignDevices, bulkUpdateDevices, distributeDevices, removeDevice, type AlignMode } from '../../model/ops';
import type { Device } from '../../model/schema';
import { NO_SELECTION, useProject } from '../../store/useProject';
import { Field, Section, Select } from '../form';

const MIXED = '__mixed__';

const ALIGN: { mode: AlignMode; label: string; icon: ReactElement }[] = [
  { mode: 'left', label: 'Align left edges', icon: <AlignStartVertical size={16} /> },
  { mode: 'hcentre', label: 'Align centres horizontally', icon: <AlignCenterVertical size={16} /> },
  { mode: 'right', label: 'Align right edges', icon: <AlignEndVertical size={16} /> },
  { mode: 'top', label: 'Align top edges', icon: <AlignStartHorizontal size={16} /> },
  { mode: 'vcentre', label: 'Align centres vertically', icon: <AlignCenterHorizontal size={16} /> },
  { mode: 'bottom', label: 'Align bottom edges', icon: <AlignEndHorizontal size={16} /> },
];

/** The shared value of a field across devices, or MIXED when they differ. */
function common<K extends keyof Device>(devices: Device[], key: K): string {
  const values = new Set(devices.map((d) => String(d[key] ?? '')));
  return values.size === 1 ? [...values][0] : MIXED;
}

export function BulkInspector({ ids }: { ids: string[] }) {
  const project = useProject((s) => s.project);
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const devices = project.devices.filter((d) => ids.includes(d.id));
  const mixed = { value: MIXED, label: 'Mixed' };

  const zone = common(devices, 'zoneId');
  const criticality = common(devices, 'criticality');

  return (
    <>
      <Section title={`${devices.length} devices selected`}>
        <Field label="Security zone">
          <Select
            value={zone}
            options={[
              ...(zone === MIXED ? [mixed] : []),
              { value: '', label: 'No zone' },
              ...project.zones.map((z) => ({ value: z.id, label: z.name })),
            ]}
            onChange={(v) => v !== MIXED && apply((p) => bulkUpdateDevices(p, ids, { zoneId: v === '' ? null : v }))}
          />
        </Field>
        <Field label="Criticality">
          <Select
            value={criticality}
            options={[
              ...(criticality === MIXED ? [mixed] : []),
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
            onChange={(v) => v !== MIXED && apply((p) => bulkUpdateDevices(p, ids, { criticality: v as Device['criticality'] }))}
          />
        </Field>
      </Section>

      <Section title="Arrange">
        <div className="tool-grid" role="group" aria-label="Align">
          {ALIGN.map((a) => (
            <button key={a.mode} type="button" className="icon-button" title={a.label} aria-label={a.label} onClick={() => apply((p) => alignDevices(p, ids, a.mode))}>
              {a.icon}
            </button>
          ))}
        </div>
        <div className="tool-grid" role="group" aria-label="Distribute">
          <button
            type="button"
            className="icon-button"
            disabled={devices.length < 3}
            title="Distribute horizontally"
            aria-label="Distribute horizontally"
            onClick={() => apply((p) => distributeDevices(p, ids, 'x'))}
          >
            <AlignHorizontalDistributeCenter size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={devices.length < 3}
            title="Distribute vertically"
            aria-label="Distribute vertically"
            onClick={() => apply((p) => distributeDevices(p, ids, 'y'))}
          >
            <AlignVerticalDistributeCenter size={16} />
          </button>
        </div>
        <p className="muted">Moving devices vertically can change their Purdue level.</p>
      </Section>

      <div className="panel-actions">
        <button
          type="button"
          className="button danger"
          onClick={() => {
            if (!window.confirm(`Delete ${devices.length} devices and their connections?`)) return;
            apply((p) => ids.reduce(removeDevice, p));
            select(NO_SELECTION);
          }}
        >
          <Trash2 size={16} />
          Delete {devices.length} devices
        </button>
      </div>
    </>
  );
}
