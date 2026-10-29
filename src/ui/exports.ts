// Exports started from the Export menu, the command palette and the Security panel. All three load
// on demand, so this module and the writers behind it stay out of the startup bundle.
import type { ReactFlowInstance } from '@xyflow/react';
import type { PathOverrides } from '../model/attack/paths';
import type { Project } from '../model/schema';
import { announce } from '../store/announcer';
import type { CanvasEdge } from './canvas/edges';
import type { CanvasNode } from './canvas/nodes';
import { downloadText, downloadUrl, slug } from './download';
import { exportDiagram } from './exportDiagram';

type Flow = ReactFlowInstance<CanvasNode, CanvasEdge>;

export type TextExport = 'report' | 'drawio' | 'md' | 'devices' | 'links' | 'flows' | 'rules';

/** File exports; the writers (and the CSV library) load on first use. */
export async function exportText(project: Project, kind: TextExport): Promise<void> {
  const m = await import('../model/exportFiles');
  const files: Record<TextExport, [string, string, () => string]> = {
    report: ['-report.html', 'text/html', () => m.projectToHtmlReport(project)],
    drawio: ['.drawio', 'application/xml', () => m.projectToDrawio(project)],
    md: ['.md', 'text/markdown', () => m.projectToMarkdown(project)],
    devices: ['-devices.csv', 'text/csv', () => m.devicesToCsv(project)],
    links: ['-links.csv', 'text/csv', () => m.linksToCsv(project)],
    flows: ['-flows.csv', 'text/csv', () => m.flowsToCsv(project)],
    rules: ['-firewall-rules.csv', 'text/csv', () => m.rulesToCsv(project)],
  };
  const [suffix, mime, write] = files[kind];
  downloadText(`${slug(project.name)}${suffix}`, write(), mime);
}

/** Opens the browser's print dialog for the full report, where it can also be saved as PDF. */
export async function printReport(project: Project): Promise<void> {
  const [m, { printHtml }] = await Promise.all([import('../model/exportFiles'), import('../export/print')]);
  printHtml(m.projectToHtmlReport(project));
}

/**
 * Downloads attack paths as a MITRE Attack Flow file (STIX 2.1): the one given, or every path
 * shown. The path finder and the exporter load on first use.
 */
export async function exportAttackFlow(project: Project, overrides: PathOverrides, pathId: string | null = null): Promise<void> {
  const [paths, flow] = await Promise.all([import('../model/attack/paths'), import('../model/attack/attackFlow')]);
  const all = paths.attackPathsOf(project, overrides).paths;
  const chosen = pathId ? all.filter((p) => p.id === pathId) : all;
  if (chosen.length === 0) {
    announce('No attack paths to export');
    return;
  }
  downloadText(`${slug(project.name)}-attack-flow.json`, JSON.stringify(flow.toAttackFlow(project, chosen), null, 2), 'application/json');
  announce(`Exported ${chosen.length} attack path${chosen.length === 1 ? '' : 's'} as a MITRE Attack Flow file`);
}

export async function exportImage(rf: Flow, project: Project, format: 'svg' | 'png', onErrors: (errors: string[]) => void): Promise<void> {
  try {
    downloadUrl(`${slug(project.name)}.${format}`, await exportDiagram(rf, format));
  } catch (err) {
    onErrors([`Could not export the diagram: ${(err as Error).message}`]);
  }
}
