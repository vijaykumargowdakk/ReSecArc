// Connecting devices without a mouse: with a device focused or selected, L starts a link and F a flow.
// The arrow keys then move a highlight to the nearest device that way, Enter connects and Esc cancels.
import { useEffect } from 'react';
import { arrowDirection, nearestInDirection, type Direction } from '../../model/direction';
import { addFlow, addLink, defaultFlow } from '../../model/ops';
import { getProtocol } from '../../model/protocols';
import { NODE_HEIGHT, NODE_WIDTH } from '../../model/purdue';
import type { Device } from '../../model/schema';
import { announce } from '../../store/announcer';
import { useProject, type ConnectMode } from '../../store/useProject';
import { isTyping } from '../useShortcuts';

const DIRECTION_WORDS: Record<Direction, string> = { up: 'above', down: 'below', left: 'to the left', right: 'to the right' };

const centre = (d: Device) => ({ x: d.position.x + NODE_WIDTH / 2, y: d.position.y + NODE_HEIGHT / 2 });

/** Devices drawn on the open site: those inside a collapsed area are not on the canvas. */
function drawnDevices(): Device[] {
  const { project, activeSiteId } = useProject.getState();
  const collapsed = new Set(project.areas.filter((a) => a.collapsed).map((a) => a.id));
  return project.devices.filter((d) => d.siteId === activeSiteId && !(d.areaId && collapsed.has(d.areaId)));
}

/** The focused device node, or the one selected device while focus is on the canvas or nowhere in particular. */
function sourceDevice(): Device | null {
  const active = document.activeElement;
  const node = active instanceof HTMLElement ? active.closest('.react-flow__node-device') : null;
  const drawn = drawnDevices();
  if (node) return drawn.find((d) => d.id === node.getAttribute('data-id')) ?? null;
  if (active instanceof HTMLElement && active !== document.body && !active.closest('.react-flow')) return null;
  const { devices } = useProject.getState().selection;
  return devices.length === 1 ? (drawn.find((d) => d.id === devices[0]) ?? null) : null;
}

/** Starts a keyboard connection from a device on the open site; returns false when it is not drawn there. */
export function startKeyboardConnect(mode: ConnectMode, deviceId: string): boolean {
  const s = useProject.getState();
  const source = drawnDevices().find((d) => d.id === deviceId);
  if (!source) return false;
  s.setPendingConnect({ mode, sourceId: source.id, targetId: null });
  const what = mode === 'link' ? `Linking from ${source.label}` : `${getProtocol(s.flowProtocol)?.label ?? s.flowProtocol} flow from ${source.label}`;
  announce(`${what}. Use arrow keys to choose a device, Enter to connect, Escape to cancel.`);
  return true;
}

/** Handles the keys on the canvas; `reveal` scrolls a newly highlighted device into view. */
export function useKeyboardConnect(reveal: (device: Device) => void): void {
  useEffect(() => {
    // Capture phase, so that while a connection is pending the arrow keys and Enter reach this
    // handler instead of moving or selecting the focused node.
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const s = useProject.getState();
      const pending = s.pendingConnect;
      if (!pending) {
        const key = e.key.toLowerCase();
        if (key !== 'l' && key !== 'f') return;
        const source = sourceDevice();
        if (source && startKeyboardConnect(key === 'l' ? 'link' : 'flow', source.id)) e.preventDefault();
        return;
      }

      const devices = drawnDevices();
      const source = devices.find((d) => d.id === pending.sourceId);
      const target = devices.find((d) => d.id === pending.targetId);
      const dir = arrowDirection(e.key);
      if (e.key !== 'Escape' && e.key !== 'Enter' && !dir) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape' || !source) {
        s.setPendingConnect(null);
        announce('Connection cancelled');
        return;
      }
      if (dir) {
        const from = centre(target ?? source);
        const candidates = devices.filter((d) => d.id !== source.id).map((d) => ({ id: d.id, ...centre(d) }));
        const next = devices.find((d) => d.id === nearestInDirection(from, candidates, dir));
        if (!next) {
          announce(`No device ${DIRECTION_WORDS[dir]}`);
          return;
        }
        s.setPendingConnect({ ...pending, targetId: next.id });
        reveal(next);
        announce(`Target: ${next.label}`);
        return;
      }
      if (!target) {
        announce('Choose a device with the arrow keys first, or press Escape to cancel.');
        return;
      }
      if (pending.mode === 'link') s.apply((p) => addLink(p, source.id, target.id));
      else s.apply((p) => addFlow(p, defaultFlow(s.flowProtocol, source.id, target.id)));
      s.setPendingConnect(null);
      announce(`${pending.mode === 'link' ? 'Link' : 'Flow'} added from ${source.label} to ${target.label}`);
    };
    // Clicking anywhere ends a keyboard connection; the mouse has its own way to connect.
    const onPointer = () => {
      if (!useProject.getState().pendingConnect) return;
      useProject.getState().setPendingConnect(null);
      announce('Connection cancelled');
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      useProject.getState().setPendingConnect(null);
    };
  }, [reveal]);
}
