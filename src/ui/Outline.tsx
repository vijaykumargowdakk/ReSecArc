import { Building2, Cable, ChevronDown, ChevronRight, Layers, Shield, SquareDashed, StickyNote, Workflow } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { dimmedIds, isFiltering } from '../model/filter';
import { addFlow, addLink, defaultFlow } from '../model/ops';
import { buildOutline, nextMatch, visibleRows, type OutlineItem, type OutlineKind } from '../model/outline';
import { getProtocol } from '../model/protocols';
import type { Device } from '../model/schema';
import { announce } from '../store/announcer';
import { NO_SELECTION, useProject, type ConnectMode, type Selection } from '../store/useProject';
import { deleteDeviceAfterConfirm } from './actions';
import { DevicePicker } from './DevicePicker';
import { DeviceIcon } from './icons';

const ICONS: Partial<Record<OutlineKind, ReactNode>> = {
  site: <Building2 size={15} />,
  level: <Layers size={15} />,
  link: <Cable size={15} />,
  flow: <Workflow size={15} />,
  areas: <SquareDashed size={15} />,
  area: <SquareDashed size={15} />,
  notes: <StickyNote size={15} />,
  note: <StickyNote size={15} />,
  zones: <Shield size={15} />,
  zone: <Shield size={15} />,
};

/** Selection key for the kinds of row that stand for a selectable item. */
const SELECTION_KEY: Partial<Record<OutlineKind, keyof Selection>> = { device: 'devices', link: 'links', flow: 'flows', area: 'areas', note: 'notes' };

/** Moves focus to the first field of the properties panel once it shows the new selection. */
function focusProperties(tries = 20): void {
  requestAnimationFrame(() => {
    const panel = document.querySelector<HTMLElement>('.inspector');
    const field = panel?.querySelector<HTMLElement>('input, select, textarea, button');
    if (field && !panel?.querySelector('.inspector__loading')) field.focus();
    else if (tries > 0) focusProperties(tries - 1);
  });
}

/**
 * The design as a keyboard-navigable tree (WAI-ARIA tree pattern with a roving tabindex). Items the
 * filter leaves out are not listed.
 */
export function Outline() {
  const project = useProject((s) => s.project);
  const filter = useProject((s) => s.filter);
  const selection = useProject((s) => s.selection);
  const activeSiteId = useProject((s) => s.activeSiteId);
  const flowProtocol = useProject((s) => s.flowProtocol);
  const hidden = useMemo(() => dimmedIds(project, filter), [project, filter]);
  const tree = useMemo(() => buildOutline(project, hidden), [project, hidden]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([...project.sites.map((s) => s.id), ...tree.find((i) => i.id === activeSiteId)!.children.filter((i) => i.kind === 'level').map((i) => i.id)]),
  );
  const rows = useMemo(() => visibleRows(tree, expanded), [tree, expanded]);
  const indexById = useMemo(() => new Map(rows.map((r, i) => [r.item.id, i])), [rows]);
  const deviceById = useMemo(() => new Map(project.devices.map((d) => [d.id, d])), [project.devices]);
  const [focusedId, setFocusedId] = useState(() => rows[0]?.item.id ?? '');
  const lastIndex = useRef(0);
  // Set when a key press moves focus, so the effect below focuses the new row (not on every render).
  const moveFocus = useRef(false);
  const [picking, setPicking] = useState<{ mode: ConnectMode; device: Device } | null>(null);

  // The focused row may disappear (deleted, filtered out, parent collapsed); fall back to the row now in its place.
  const current = indexById.get(focusedId) ?? Math.min(lastIndex.current, rows.length - 1);
  lastIndex.current = current;
  const currentId = rows[current]?.item.id;

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    document.getElementById(`outline-item-${current}`)?.focus();
  });

  const focusRow = (index: number) => {
    if (index < 0 || index >= rows.length) return;
    moveFocus.current = true;
    setFocusedId(rows[index].item.id);
  };
  const setOpen = (id: string, open: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  const isSelected = (item: OutlineItem) => {
    const key = SELECTION_KEY[item.kind];
    return key ? selection[key].includes(item.ref) : false;
  };

  /** Shows the item in the properties panel; groups open or close instead. */
  const activate = (item: OutlineItem, toProperties: boolean) => {
    const s = useProject.getState();
    const key = SELECTION_KEY[item.kind];
    if (item.kind === 'device') s.focusDevice(item.ref);
    else if (key && item.siteId) {
      s.setActiveSite(item.siteId);
      s.select({ ...NO_SELECTION, [key]: [item.ref] });
    } else if (item.kind === 'site' || item.kind === 'zone') {
      // Sites and zones are edited in the project panel, shown when nothing is selected.
      if (item.kind === 'site') s.setActiveSite(item.ref);
      s.select(NO_SELECTION);
    } else {
      setOpen(item.id, !expanded.has(item.id));
      return;
    }
    if (toProperties) focusProperties();
    else announce(`${item.label} selected`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const row = rows[current];
    if (!row || e.ctrlKey || e.metaKey || e.altKey) return;
    const { item } = row;
    const hasChildren = item.children.length > 0;
    const open = hasChildren && expanded.has(item.id);
    const device = item.kind === 'device' ? deviceById.get(item.ref) : undefined;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    let handled = true;
    if (key === 'ArrowDown') focusRow(current + 1);
    else if (key === 'ArrowUp') focusRow(current - 1);
    else if (key === 'Home') focusRow(0);
    else if (key === 'End') focusRow(rows.length - 1);
    else if (key === 'ArrowRight') {
      if (hasChildren && !open) setOpen(item.id, true);
      else if (open) focusRow(current + 1);
    } else if (key === 'ArrowLeft') {
      if (open) setOpen(item.id, false);
      else if (row.parentId) focusRow(indexById.get(row.parentId) ?? current);
    } else if (key === 'Enter') activate(item, true);
    else if (key === ' ') activate(item, false);
    else if (device && (key === 'l' || key === 'f')) setPicking({ mode: key === 'l' ? 'link' : 'flow', device });
    else if (device && key === 'Delete') {
      if (deleteDeviceAfterConfirm(device.id)) {
        announce(`Deleted ${device.label}`);
        moveFocus.current = true;
      }
    } else if (/^[a-z0-9]$/i.test(e.key)) {
      // Letters and digits only, so ? and / still open help and search.
      const match = nextMatch(rows, current, e.key);
      if (match >= 0) focusRow(match);
    } else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const closePicker = () => {
    setPicking(null);
    moveFocus.current = true;
    setFocusedId(picking?.device.id ?? focusedId);
  };

  const connect = (targetId: string) => {
    if (!picking) return;
    const { device, mode } = picking;
    const target = deviceById.get(targetId);
    if (mode === 'link') useProject.getState().apply((p) => addLink(p, device.id, targetId));
    else useProject.getState().apply((p) => addFlow(p, defaultFlow(flowProtocol, device.id, targetId)));
    announce(`${mode === 'link' ? 'Link' : 'Flow'} added from ${device.label} to ${target?.label ?? targetId}`);
    setOpen(device.id, true);
    closePicker();
  };

  const renderItems = (items: OutlineItem[]): ReactNode =>
    items.map((item) => {
      const i = indexById.get(item.id);
      if (i === undefined) return null;
      const row = rows[i];
      const hasChildren = item.children.length > 0;
      const open = hasChildren && expanded.has(item.id);
      const selected = isSelected(item);
      const device = item.kind === 'device' ? deviceById.get(item.ref) : undefined;
      // The row is the treeitem and owns its group (as in the WAI-ARIA navigation treeview), so each
      // item's accessible name is just its own text rather than everything nested inside it.
      return (
        <li key={item.id} role="none">
          <div
            id={`outline-item-${i}`}
            role="treeitem"
            className={`outline__row outline__row--${item.kind}${selected ? ' is-selected' : ''}`}
            style={{ paddingLeft: 6 + (row.level - 1) * 18 }}
            aria-level={row.level}
            aria-setsize={row.setSize}
            aria-posinset={row.posInSet}
            aria-expanded={hasChildren ? open : undefined}
            aria-owns={open ? `outline-group-${i}` : undefined}
            aria-selected={SELECTION_KEY[item.kind] ? selected : undefined}
            tabIndex={item.id === currentId ? 0 : -1}
            onFocus={() => setFocusedId(item.id)}
            onClick={() => activate(item, false)}
          >
            <span
              className="outline__twisty"
              aria-hidden="true"
              onClick={(e) => {
                if (!hasChildren) return;
                e.stopPropagation();
                setFocusedId(item.id);
                setOpen(item.id, !open);
              }}
            >
              {hasChildren && (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
            </span>
            <span className="outline__icon" aria-hidden="true">
              {device ? <DeviceIcon type={device.type} variant={device.variant} size={18} /> : ICONS[item.kind]}
            </span>
            <span className="outline__text">
              <span className="outline__label">
                {item.label}
                {item.detail && <span className="outline__comma">,</span>}
              </span>
              {item.detail && <span className="outline__detail">{item.detail}</span>}
            </span>
          </div>
          {open && (
            <ul id={`outline-group-${i}`} role="group">
              {renderItems(item.children)}
            </ul>
          )}
        </li>
      );
    });

  const shown = project.devices.length - [...hidden].filter((id) => deviceById.has(id)).length;
  const protocolLabel = getProtocol(flowProtocol)?.label ?? flowProtocol;

  return (
    <div className="outline">
      <div className="outline__bar">
        <p id="outline-help" className="muted outline__help">
          Arrow keys move; Right and Left open and close. Enter opens the properties, Space selects. On a device, L links it, F adds a{' '}
          {protocolLabel} flow, Delete removes it. Type a letter to jump.
        </p>
        {isFiltering(filter) && (
          <p className="outline__filtered" role="status">
            Filtered: showing {shown} of {project.devices.length} devices.
          </p>
        )}
        <div className="button-row">
          <button type="button" className="button" onClick={() => setExpanded(new Set(collectParents(tree)))}>
            Expand all
          </button>
          <button type="button" className="button" onClick={() => setExpanded(new Set())}>
            Collapse all
          </button>
        </div>
      </div>
      {picking && (
        <div
          className="outline__picker"
          role="group"
          aria-label={picking.mode === 'link' ? `Link ${picking.device.label}` : `Flow from ${picking.device.label}`}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            closePicker();
          }}
        >
          <p>{picking.mode === 'link' ? `Link ${picking.device.label} to:` : `${protocolLabel} flow from ${picking.device.label} to:`}</p>
          <DevicePicker
            excludeId={picking.device.id}
            siteId={picking.device.siteId}
            label={picking.mode === 'link' ? `Link ${picking.device.label} to` : `Flow from ${picking.device.label} to`}
            onPick={connect}
          />
          <button type="button" className="button" onClick={closePicker}>
            Cancel
          </button>
        </div>
      )}
      <div className="outline__scroll">
        {rows.length === 0 ? (
          <p className="muted outline__empty">Nothing to show.</p>
        ) : (
          <ul className="outline__tree" role="tree" aria-label="Design outline" aria-describedby="outline-help" onKeyDown={onKeyDown}>
            {renderItems(tree)}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Ids of every item that has children. */
function collectParents(items: OutlineItem[]): string[] {
  return items.flatMap((i) => (i.children.length ? [i.id, ...collectParents(i.children)] : []));
}
