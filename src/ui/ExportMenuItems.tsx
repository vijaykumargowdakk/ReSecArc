// The Export menu's items, loaded the first time the menu opens so the startup bundle stays small.
import { useReactFlow } from '@xyflow/react';
import { useProject } from '../store/useProject';
import { exportImage, exportText, printReport, type TextExport } from './exports';
import type { CanvasEdge } from './canvas/edges';
import type { CanvasNode } from './canvas/nodes';

export function ExportMenuItems({
  diagramVisible,
  onShare,
  onErrors,
  closeMenu,
}: {
  diagramVisible: boolean;
  onShare: () => void;
  onErrors: (errors: string[]) => void;
  closeMenu: () => void;
}) {
  const reactFlow = useReactFlow<CanvasNode, CanvasEdge>();
  const project = useProject((s) => s.project);
  const exportAs = (format: 'svg' | 'png') => {
    closeMenu();
    void exportImage(reactFlow, project, format, onErrors);
  };
  const exportFile = (kind: TextExport) => {
    closeMenu();
    void exportText(project, kind);
  };

  return (
    <div className="menu__items" role="menu">
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          closeMenu();
          onShare();
        }}
      >
        Share as a link…
      </button>
      <hr />
      <button type="button" role="menuitem" disabled={!diagramVisible} onClick={() => exportAs('svg')} title={diagramVisible ? undefined : 'Switch to the diagram view first'}>
        Diagram as SVG
      </button>
      <button type="button" role="menuitem" disabled={!diagramVisible} onClick={() => exportAs('png')} title={diagramVisible ? undefined : 'Switch to the diagram view first'}>
        Diagram as PNG
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!diagramVisible}
        onClick={() => {
          closeMenu();
          window.print();
        }}
      >
        Print / save as PDF…
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => exportFile('report')} title="Every site's diagram and tables, zones, IP plan, security findings and attack paths">
        Full report (HTML)
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          closeMenu();
          void printReport(project);
        }}
      >
        Print full report / save as PDF…
      </button>
      <button type="button" role="menuitem" onClick={() => exportFile('drawio')} title="One page per site, editable in draw.io (diagrams.net)">
        All sites for draw.io
      </button>
      <button type="button" role="menuitem" onClick={() => exportFile('md')}>
        Architecture document (Markdown)
      </button>
      <button type="button" role="menuitem" onClick={() => exportFile('devices')}>
        Devices (CSV)
      </button>
      <button type="button" role="menuitem" onClick={() => exportFile('links')}>
        Network links (CSV)
      </button>
      <button type="button" role="menuitem" onClick={() => exportFile('flows')}>
        Protocol flows (CSV)
      </button>
      <button type="button" role="menuitem" onClick={() => exportFile('rules')}>
        Firewall rules (CSV)
      </button>
    </div>
  );
}
