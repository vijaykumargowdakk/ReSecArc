import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { usePrefs } from '../store/prefs';

interface Step {
  /** CSS selector of the element the step points at. */
  target: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    target: '.palette',
    title: 'Add devices',
    text: 'Drag a device type onto the canvas, or select it and press Enter. Open the arrow next to a type for specific kinds, such as a compact PLC or a protection relay.',
  },
  {
    target: '.canvas',
    title: 'Purdue levels',
    text: 'Each band is a Purdue level, from enterprise (L5) down to the physical process (L0). A device takes the level of the band it sits in. Drag from the bottom handle of one device to another to connect them.',
  },
  {
    target: '[aria-label="Connection type"]',
    title: 'Links and flows',
    text: 'Choose whether new connections are network links (cables) or protocol flows (who talks to whom), and which protocol new flows use.',
  },
  {
    target: '.inspector',
    title: 'Properties',
    text: 'Edit whatever is selected here. With nothing selected you see the whole project: zones, networks, custom fields and saved revisions.',
  },
  {
    target: '.view-switch',
    title: 'Diagram and inventory',
    text: 'The inventory shows every device, link, flow, firewall rule and IP address as tables you can edit, import and export.',
  },
  {
    target: '.export-menu',
    title: 'Save, export and share',
    text: 'Save the project file, export diagrams, documents and spreadsheets, or share the design as a link. Press Ctrl + Shift + P at any time to run any command by name.',
  },
];

const CARD_WIDTH = 320;
/** About how tall the card is; used to keep it on screen and clear of the lane buttons. */
const CARD_HEIGHT = 220;
const GAP = 14;

/** Where the card goes: beside the target if there is room, otherwise below or above it, kept on screen. */
function basePosition(rect: DOMRect | null): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect) return { left: vw / 2 - CARD_WIDTH / 2, top: vh / 3 };
  const clampX = (x: number) => Math.min(Math.max(GAP, x), vw - CARD_WIDTH - GAP);
  const clampY = (y: number) => Math.min(Math.max(GAP, y), vh - CARD_HEIGHT);
  if (rect.right + GAP + CARD_WIDTH < vw && rect.width < vw / 2) return { left: rect.right + GAP, top: clampY(rect.top) };
  if (rect.left - GAP - CARD_WIDTH > 0 && rect.width < vw / 2) return { left: rect.left - GAP - CARD_WIDTH, top: clampY(rect.top) };
  if (rect.bottom + CARD_HEIGHT < vh) return { left: clampX(rect.left), top: rect.bottom + GAP };
  return { left: clampX(rect.left + rect.width / 2 - CARD_WIDTH / 2), top: clampY(rect.top + rect.height / 2 - 100) };
}

/**
 * The card's place, moved right past any lane buttons it would cover (issue #52): beside the palette
 * it lands on the canvas's left edge, where the lane labels and their buttons are.
 */
export function cardPosition(rect: DOMRect | null, avoid: readonly DOMRect[]): CSSProperties {
  let { left } = basePosition(rect);
  const { top } = basePosition(rect);
  const overlaps = (r: DOMRect) => r.left < left + CARD_WIDTH && left < r.right && r.top < top + CARD_HEIGHT && top < r.bottom;
  const covered = avoid.filter(overlaps);
  if (covered.length) {
    const right = Math.max(...covered.map((r) => r.right)) + GAP;
    // Only when it still fits on screen; otherwise the card stays where it was.
    if (right + CARD_WIDTH <= window.innerWidth - GAP) left = right;
  }
  return { left, top };
}

/** A short first-run tour pointing at the main parts of the screen. Esc or "Skip tour" ends it. */
export function Tour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [avoid, setAvoid] = useState<DOMRect[]>([]);
  const primary = useRef<HTMLButtonElement>(null);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  // Measured again when a panel opens or closes, since that moves the targets.
  const panels = usePrefs((s) => s.panels);
  useLayoutEffect(() => {
    const update = () => {
      setRect(document.querySelector(current.target)?.getBoundingClientRect() ?? null);
      setAvoid([...document.querySelectorAll('.lane__button')].map((el) => el.getBoundingClientRect()));
    };
    update();
    // The canvas frames the plant with a short animation once the project has loaded, which moves the
    // lane buttons; measure again whenever the canvas view moves.
    const viewport = new MutationObserver(update);
    const watch = () => {
      const el = document.querySelector('.react-flow__viewport');
      if (el) viewport.observe(el, { attributes: true, attributeFilter: ['style'] });
      return el !== null;
    };
    const retry = watch() ? undefined : window.setTimeout(watch, 500);
    window.addEventListener('resize', update);
    return () => {
      window.clearTimeout(retry);
      viewport.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [current.target, panels]);

  useEffect(() => primary.current?.focus(), [step]);

  // The tour points at both side panels, so folded ones open for it.
  useEffect(() => {
    const { setPanelOpen } = usePrefs.getState();
    setPanelOpen('palette', true);
    setPanelOpen('inspector', true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tour">
      {rect && (
        <div
          className="tour__spot"
          aria-hidden="true"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <section className="tour__card" role="dialog" aria-labelledby="tour-title" aria-describedby="tour-text" style={{ ...cardPosition(rect, avoid), width: CARD_WIDTH }}>
        <p className="tour__count">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title">{current.title}</h2>
        <p id="tour-text">{current.text}</p>
        <div className="tour__actions">
          <button type="button" className="button tour__skip" onClick={onClose}>
            Skip tour
          </button>
          {step > 0 && (
            <button type="button" className="button" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button ref={primary} type="button" className="button button--primary" onClick={() => (last ? onClose() : setStep(step + 1))}>
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </section>
    </div>
  );
}
