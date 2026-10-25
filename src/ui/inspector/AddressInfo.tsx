import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { addressReport } from '../../model/ipam';
import type { Device } from '../../model/schema';
import { useProject } from '../../store/useProject';

export function IssueList({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="issues">
      {issues.map((text, i) => (
        <li key={i}>
          <TriangleAlert size={13} aria-hidden="true" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Which planned network each of a device's addresses is in, plus any addressing warnings. */
export function AddressInfo({ device }: { device: Device }) {
  const project = useProject((s) => s.project);
  const report = useMemo(() => addressReport(project), [project]);
  const addresses = report.addresses.get(device.id) ?? [];
  const issues = (report.issues.get(device.id) ?? []).map((i) => i.message);
  if (addresses.length === 0 || (project.networks.length === 0 && issues.length === 0)) return null;
  return (
    <div className="address-info">
      <ul>
        {addresses
          .filter((a) => a.ip !== null)
          .map((a) => (
            <li key={a.address}>
              <span className="mono">{a.address}</span>
              {a.network && (
                <span className="muted">
                  {' '}
                  in {a.network.name || a.network.cidr} <span className="mono">({a.network.cidr})</span>
                  {a.network.vlan !== null && ` · VLAN ${a.network.vlan}`}
                </span>
              )}
            </li>
          ))}
      </ul>
      <IssueList issues={issues} />
    </div>
  );
}
