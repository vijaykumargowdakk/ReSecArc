// Operations on sites and areas: the structure that lets one project describe a whole estate.
import { areaAt, type Rect } from './areas';
import { newId, updateDevice } from './ops';
import { levelAtY } from './purdue';
import type { Area, Project, Site } from './schema';

export const AREA_COLORS = ['#0ea5e9', '#f59e0b', '#16a34a', '#8b5cf6', '#db2777', '#0d9488'];

export function addSite(project: Project, name: string, id = newId('site')): Project {
  const site: Site = { id, name };
  return { ...project, sites: [...project.sites, site] };
}

export function renameSite(project: Project, id: string, name: string): Project {
  return { ...project, sites: project.sites.map((s) => (s.id === id ? { ...s, name } : s)) };
}

/** A site can be removed only when it is empty and is not the last one. */
export function canRemoveSite(project: Project, id: string): boolean {
  return project.sites.length > 1 && !project.devices.some((d) => d.siteId === id);
}

export function removeSite(project: Project, id: string): Project {
  if (!canRemoveSite(project, id)) return project;
  return { ...project, sites: project.sites.filter((s) => s.id !== id), areas: project.areas.filter((a) => a.siteId !== id) };
}

/** Recomputes area membership for every device on a site. */
export function reassignAreas(project: Project, siteId: string): Project {
  return {
    ...project,
    devices: project.devices.map((d) => {
      if (d.siteId !== siteId) return d;
      const areaId = areaAt(project, siteId, d.position);
      return areaId === d.areaId ? d : { ...d, areaId };
    }),
  };
}

export function moveDevicesToSite(project: Project, ids: readonly string[], siteId: string): Project {
  if (!project.sites.some((s) => s.id === siteId)) return project;
  const set = new Set(ids);
  return {
    ...project,
    devices: project.devices.map((d) => (set.has(d.id) ? { ...d, siteId, areaId: areaAt(project, siteId, d.position) } : d)),
  };
}

export function createArea(siteId: string, rect: Rect, name: string, color: string, id = newId('area')): Area {
  return { id, siteId, name, color, rect, collapsed: false };
}

export function addArea(project: Project, area: Area): Project {
  return reassignAreas({ ...project, areas: [...project.areas, area] }, area.siteId);
}

export function updateArea(project: Project, id: string, patch: Partial<Omit<Area, 'id' | 'siteId'>>): Project {
  const area = project.areas.find((a) => a.id === id);
  if (!area) return project;
  const next = { ...project, areas: project.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
  return patch.rect ? reassignAreas(next, area.siteId) : next;
}

/** Moves an area to a new top-left corner, carrying its member devices with it. */
export function moveArea(project: Project, id: string, to: { x: number; y: number }): Project {
  const area = project.areas.find((a) => a.id === id);
  if (!area) return project;
  const dx = to.x - area.rect.x;
  const dy = to.y - area.rect.y;
  if (dx === 0 && dy === 0) return project;
  let next: Project = { ...project, areas: project.areas.map((a) => (a.id === id ? { ...a, rect: { ...a.rect, x: to.x, y: to.y } } : a)) };
  for (const d of project.devices.filter((dev) => dev.areaId === id)) {
    const position = { x: d.position.x + dx, y: d.position.y + dy };
    next = updateDevice(next, d.id, { position, purdueLevel: levelAtY(position.y) });
  }
  return reassignAreas(next, area.siteId);
}

/** Removes an area; its devices stay where they are. */
export function removeArea(project: Project, id: string): Project {
  return {
    ...project,
    areas: project.areas.filter((a) => a.id !== id),
    devices: project.devices.map((d) => (d.areaId === id ? { ...d, areaId: null } : d)),
  };
}
