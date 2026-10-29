// The Display menu's choices, loaded the first time the menu opens.
import { TEXT_SIZES, usePrefs } from '../store/prefs';
import { useTheme, type Theme } from '../store/theme';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Follow the system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'contrast', label: 'High contrast' },
];

export function DisplayMenuItems() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const textSize = usePrefs((s) => s.textSize);
  const setTextSize = usePrefs((s) => s.setTextSize);
  return (
    <div className="menu__items display-menu__items">
      <fieldset>
        <legend>Theme</legend>
        {THEMES.map((t) => (
          <label key={t.value} className="filter__option">
            <input type="radio" name="theme" checked={theme === t.value} onChange={() => setTheme(t.value)} />
            {t.label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Text size</legend>
        {TEXT_SIZES.map((t) => (
          <label key={t.value} className="filter__option">
            <input type="radio" name="text-size" checked={textSize === t.value} onChange={() => setTextSize(t.value)} />
            {t.label} ({Math.round(t.value * 100)}%)
          </label>
        ))}
        <p className="display-menu__hint">Sizes the toolbar, panels, tables and dialogs. Zoom the diagram with the canvas controls.</p>
      </fieldset>
    </div>
  );
}
