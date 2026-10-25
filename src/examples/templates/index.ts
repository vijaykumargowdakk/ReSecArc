import { parseProject } from '../../model/io';
import type { Project } from '../../model/schema';
import building from './building.json';
import manufacturing from './manufacturing.json';
import pipeline from './pipeline.json';
import substation from './substation.json';
import waterTreatment from './water-treatment.json';

export interface Template {
  id: string;
  title: string;
  description: string;
  raw: unknown;
}

/** Fictional starter architectures. None of them describes a real facility. */
export const TEMPLATES: Template[] = [
  {
    id: 'water-treatment',
    title: 'Water treatment plant',
    description: 'Purdue-layered plant with an IT/OT firewall, DMZ historian, Modbus to PLCs and DNP3 to a pump station RTU.',
    raw: waterTreatment,
  },
  {
    id: 'substation',
    title: 'Electrical substation',
    description: 'IEC 61850 station bus with protection relays, GOOSE between bays, and IEC 104 telecontrol to the control centre.',
    raw: substation,
  },
  {
    id: 'manufacturing',
    title: 'Discrete manufacturing line',
    description: 'Two cells as areas: PROFINET robots and EtherNet/IP packaging, OPC UA aggregation, and MQTT to the cloud.',
    raw: manufacturing,
  },
  {
    id: 'building',
    title: 'Building automation',
    description: 'BACnet building management with field controllers, an MS/TP router and brokered contractor access.',
    raw: building,
  },
  {
    id: 'pipeline',
    title: 'Gas pipeline (multi-site)',
    description: 'Control centre, compressor station and block valve site on separate tabs, joined over an operational WAN.',
    raw: pipeline,
  },
];

export function loadTemplate(id: string): Project {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`Unknown template "${id}"`);
  const result = parseProject(JSON.stringify(template.raw));
  if (!result.ok) throw new Error(`Template "${id}" is invalid:\n${result.errors.join('\n')}`);
  return result.project;
}
