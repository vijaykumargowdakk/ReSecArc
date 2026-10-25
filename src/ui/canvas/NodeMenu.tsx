import { Cable, Copy, Lock, LockOpen, Trash2, Workflow } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addFlow, addLink, defaultFlow, removeDevice, updateDevice } from '../../model/ops';
import { NO_SELECTION, useProject } from '../../store/useProject';
import { DevicePicker } from '../DevicePicker';

/** Right-click menu for a device on the canvas. */
export function NodeMenu({ deviceId, x, y, onClose }: { deviceId: string; x: number; y: number; onClose: () => void }) {
  const device = useProject((s) => s.project.devices.find((d) => d.id === deviceId));
  const apply = useProject((s) => s.apply);
  const select = useProject((s) => s.select);
  const duplicate = useProject((s) => s.duplicate);
  const flowProtocol = useProject((s) => s.flowProtocol);
  const [picking, setPicking] = useState<'link' | 'flow' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!device) return null;

  const connect = (targetId: string) => {
    if (picking === 'link') apply((p) => addLink(p, device.id, targetId));
    else apply((p) => addFlow(p, defaultFlow(flowProtocol, device.id, targetId)));
    onClose();
  };

  return (
    <div ref={ref} className="node-menu" role="menu" aria-label={`Actions for ${device.label}`} style={{ left: x, top: y }}>
      {picking ? (
        <DevicePicker
          excludeId={device.id}
          siteId={device.siteId}
          label={picking === 'link' ? `Link ${device.label} to` : `Flow from ${device.label} to`}
          onPick={connect}
        />
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              select({ ...NO_SELECTION, devices: [device.id] });
              duplicate();
              onClose();
            }}
          >
            <Copy size={15} /> Duplicate <kbd>Ctrl+D</kbd>
          </button>
          <button type="button" role="menuitem" onClick={() => setPicking('link')}>
            <Cable size={15} /> Link to…
          </button>
          <button type="button" role="menuitem" onClick={() => setPicking('flow')}>
            <Workflow size={15} /> Flow to…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              apply((p) => updateDevice(p, device.id, { locked: !device.locked }));
              onClose();
            }}
          >
            {device.locked ? <LockOpen size={15} /> : <Lock size={15} />} {device.locked ? 'Unlock' : 'Lock in place'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              apply((p) => removeDevice(p, device.id));
              select(NO_SELECTION);
              onClose();
            }}
          >
            <Trash2 size={15} /> Delete <kbd>Del</kbd>
          </button>
        </>
      )}
    </div>
  );
}
