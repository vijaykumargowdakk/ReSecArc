import { Panel } from '@xyflow/react';
import { getProtocol } from '../../model/protocols';
import { useProject } from '../../store/useProject';

/** Key for the protocols used in the current project: colour, dash pattern and name. */
export function Legend() {
  const flows = useProject((s) => s.project.flows);
  const protocols = [...new Set(flows.map((f) => f.protocol))]
    .map((id) => getProtocol(id))
    .filter((p) => p !== undefined)
    .sort((a, b) => a.label.localeCompare(b.label));
  if (protocols.length === 0) return null;

  return (
    <Panel position="top-right" className="legend" aria-label="Protocol legend">
      <ul>
        <li>
          <svg width="34" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="33" y2="4" className="legend__link" />
          </svg>
          Network link
        </li>
        {protocols.map((p) => (
          <li key={p.id}>
            <svg width="34" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="33" y2="4" stroke={p.color} strokeWidth="2" strokeDasharray={p.dash} />
            </svg>
            {p.label}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
