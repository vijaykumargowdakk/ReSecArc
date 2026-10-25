import { describe, expect, it } from 'vitest';
import { loadTemplate } from '../examples/templates';
import { flowsToCsv, rulesToCsv } from './csv';
import { importFlows, importRules, parseFlowCsv, parseRuleCsv } from './csvImport';
import { parseProject, serializeProject } from './io';
import type { Project } from './schema';

const withoutIds = <T extends { id: string }>(list: T[]) => list.map((x) => ({ ...x, id: '' }));

describe('flow CSV import', () => {
  it('re-imports exported flows into a project that lacks them', () => {
    const full = loadTemplate('manufacturing');
    const empty: Project = { ...full, flows: [] };
    const results = parseFlowCsv(empty, flowsToCsv(full));
    expect(results.flatMap((r) => r.errors)).toEqual([]);
    const after = importFlows(empty, results);
    expect(withoutIds(after.flows)).toEqual(withoutIds(full.flows));
    expect(parseProject(serializeProject(after)).ok).toBe(true);
  });

  it('fills defaults, accepts labels and reports each bad row', () => {
    const p = loadTemplate('water-treatment');
    const csv = [
      'source,target,protocol,port,settings',
      'SCADA server,Filtration PLC,OPC UA,,securityMode=signandencrypt',
      'Engineering workstation,Chemical dosing PLC,modbus,,variant=tls',
      'Nobody,Filtration PLC,modbus,,',
      'SCADA server,Filtration PLC,teleport,,',
      'SCADA server,Filtration PLC,dnp3,99999,',
      'Site historian,Filtration PLC,modbus,,authentication=maybe',
      'Filtration HMI,Filtration PLC,modbus,,',
    ].join('\n');
    const r = parseFlowCsv(p, csv);
    expect(r[0].value).toMatchObject({ protocol: 'opcua', port: 4840, settings: { securityMode: 'signandencrypt', userAuth: 'anonymous' } });
    expect(r[1].value).toMatchObject({ protocol: 'modbus', port: 802 });
    expect(r[2].errors).toEqual(['no device named "Nobody"']);
    expect(r[3].errors).toEqual(['unknown protocol "teleport"']);
    expect(r[4].errors).toEqual(['port "99999" must be a whole number from 1 to 65535']);
    expect(r[5].errors).toEqual(['setting "authentication" must be true or false']);
    expect(r[6].errors[0]).toMatch(/already exists/);
  });

  it('rejects ambiguous device names', () => {
    const p = loadTemplate('water-treatment');
    const twin = { ...p, devices: [...p.devices, { ...p.devices.find((d) => d.label === 'SCADA server')!, id: 'scada-2' }] };
    const [row] = parseFlowCsv(twin, 'source,target,protocol\nSCADA server,Filtration PLC,modbus');
    expect(row.errors[0]).toMatch(/2 devices are named "SCADA server"/);
  });
});

describe('firewall rule CSV import', () => {
  it('replaces rules from an edited export and keeps their order', () => {
    const p = loadTemplate('water-treatment');
    const fw = p.devices.find((d) => d.firewall && d.firewall.rules.length > 1)!;
    const results = parseRuleCsv(p, rulesToCsv(p));
    expect(results.flatMap((r) => r.errors)).toEqual([]);
    const replaced = importRules(p, results, true);
    expect(withoutIds(replaced.devices.find((d) => d.id === fw.id)!.firewall!.rules)).toEqual(withoutIds(fw.firewall!.rules));
    const appended = importRules(p, results, false);
    expect(appended.devices.find((d) => d.id === fw.id)!.firewall!.rules).toHaveLength(fw.firewall!.rules.length * 2);
    expect(parseProject(serializeProject(replaced)).ok).toBe(true);
  });

  it('reads zones, devices, any and port forms, and reports bad rows', () => {
    const p = loadTemplate('water-treatment');
    const fw = p.devices.find((d) => d.firewall)!.label;
    const csv = [
      'firewall,order,action,source,destination,protocol,port,note',
      `${fw},2,deny,any,zone: Control,any,any,block`,
      `${fw},1,allow,Engineering workstation,Filtration PLC,Modbus,502,`,
      `SCADA server,3,allow,any,any,any,,`,
      `${fw},4,maybe,any,any,any,,`,
      `${fw},5,allow,zone: Nowhere,any,any,,`,
    ].join('\n');
    const r = parseRuleCsv(p, csv);
    expect(r[0].value?.rule).toMatchObject({ action: 'deny', src: { kind: 'any' }, dst: { kind: 'zone', id: 'zone-control' }, port: null, note: 'block' });
    expect(r[1].value?.rule).toMatchObject({ action: 'allow', src: { kind: 'device', id: 'ews' }, protocol: 'modbus', port: 502 });
    expect(r[2].errors).toEqual(['"SCADA server" is not a firewall']);
    expect(r[3].errors).toEqual(['action must be allow or deny']);
    expect(r[4].errors).toEqual(['no zone named "Nowhere"']);
    const after = importRules(p, r, true);
    expect(after.devices.find((d) => d.label === fw)!.firewall!.rules.map((x) => x.action)).toEqual(['allow', 'deny']);
  });
});
