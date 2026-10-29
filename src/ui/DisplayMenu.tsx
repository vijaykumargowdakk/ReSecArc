import { lazy, Suspense, useState } from 'react';

const DisplayMenuItems = lazy(() => import('./DisplayMenuItems').then((m) => ({ default: m.DisplayMenuItems })));

/** Colour theme and interface text size, both remembered in this browser. The choices load on first open. */
export function DisplayMenu() {
  const [loaded, setLoaded] = useState(false);
  return (
    <details className="menu display-menu" onToggle={(e) => e.currentTarget.open && setLoaded(true)}>
      <summary className="button" title="Colour theme and text size" aria-label="Display: colour theme and text size">
        {/* A text mark rather than an icon: it reads as text size, and costs the startup bundle nothing. */}
        <span className="display-menu__mark" aria-hidden="true">
          Aa
        </span>
      </summary>
      {loaded && (
        <Suspense fallback={null}>
          <DisplayMenuItems />
        </Suspense>
      )}
    </details>
  );
}
