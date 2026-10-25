import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { addNetwork, createNetwork, networkSummaries, removeNetwork, suggestCidr, updateNetwork } from '../../model/ipam';
import type { Network } from '../../model/schema';
import { useProject } from '../../store/useProject';
import { Field, IntInput, Section, Select, TextInput } from '../form';
import { IssueList } from './AddressInfo';

/** The project's IP plan: subnets with their VLAN, zone and site, and how full each one is. */
export function NetworksSection() {
  const project = useProject((s) => s.project);
  const apply = useProject((s) => s.apply);
  const summaries = useMemo(() => networkSummaries(project), [project]);
  const patch = (id: string, p: Partial<Omit<Network, 'id'>>) =>
    apply((q) => updateNetwork(q, id, p), `network:${id}:${Object.keys(p).join(',')}`);
  const zoneOptions = [{ value: '', label: 'No zone' }, ...project.zones.map((z) => ({ value: z.id, label: z.name }))];
  const siteOptions = [{ value: '', label: 'All sites' }, ...project.sites.map((s) => ({ value: s.id, label: s.name }))];
  const name = (n: Network) => n.name || n.cidr;

  return (
    <Section
      title="Networks"
      actions={
        <button
          type="button"
          className="icon-button"
          title="Add network"
          onClick={() => apply((q) => addNetwork(q, createNetwork(`Network ${q.networks.length + 1}`, suggestCidr(q))))}
        >
          <Plus size={16} />
          <span>Network</span>
        </button>
      }
    >
      {summaries.length === 0 && (
        <p className="empty">No networks yet. Add the IPv4 subnets in use to see which network and VLAN each device address belongs to.</p>
      )}
      <ul className="network-list">
        {summaries.map(({ network: n, error, devices, usable, overlaps, vlanClashes }) => {
          const issues = [
            ...(error ? [`Subnet: ${error}`] : []),
            ...overlaps.map((o) => `Overlaps ${name(o)} (${o.cidr})`),
            ...vlanClashes.map((o) => `VLAN ${n.vlan} is also used by ${name(o)} (${o.cidr})`),
          ];
          return (
            <li key={n.id} className="network">
              <div className="zone__row">
                <TextInput value={n.name} ariaLabel="Network name" onChange={(v) => patch(n.id, { name: v })} />
                <button
                  type="button"
                  className="icon-button danger"
                  title="Delete network"
                  aria-label={`Delete network ${name(n)}`}
                  onClick={() => apply((q) => removeNetwork(q, n.id))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="network__grid">
                <Field label="Subnet (CIDR)">
                  <input
                    type="text"
                    className="mono"
                    value={n.cidr}
                    aria-invalid={error !== null}
                    placeholder="10.0.1.0/24"
                    onChange={(e) => patch(n.id, { cidr: e.target.value })}
                  />
                </Field>
                <Field label="VLAN">
                  <IntInput value={n.vlan} min={1} max={4094} allowEmpty placeholder="none" onChange={(vlan) => patch(n.id, { vlan })} />
                </Field>
                <Field label="Zone">
                  <Select value={n.zoneId ?? ''} options={zoneOptions} onChange={(v) => patch(n.id, { zoneId: v || null })} />
                </Field>
                {project.sites.length > 1 && (
                  <Field label="Site">
                    <Select value={n.siteId ?? ''} options={siteOptions} onChange={(v) => patch(n.id, { siteId: v || null })} />
                  </Field>
                )}
              </div>
              {!error && (
                <p className="muted network__usage">
                  {devices.length} device{devices.length === 1 ? '' : 's'} · {usable.toLocaleString()} usable address{usable === 1 ? '' : 'es'}
                </p>
              )}
              <IssueList issues={issues} />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
