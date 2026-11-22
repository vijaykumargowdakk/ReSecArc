// Measures diagram text in the browser, so the report shortens long names by their real width
// rather than an estimate from the number of characters (issue #40).
import { diagramFont, type TextMeasure } from './siteSvg';

/**
 * A measure backed by a canvas in the diagram's font, or undefined where there is no canvas (Node,
 * unit tests), where the renderer falls back to its estimate. The text is measured in the fonts of
 * the browser that builds the report; a reader with other fonts may still see a name clipped, which
 * is why the renderer keeps its clip.
 */
export function canvasTextMeasure(): TextMeasure | undefined {
  if (typeof document === 'undefined') return undefined;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return undefined;
  // A report measures the same few names many times while it shortens them.
  const cache = new Map<string, number>();
  return (text, size, bold) => {
    const key = `${size}|${bold ? 1 : 0}|${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      context.font = diagramFont(size, bold);
      width = context.measureText(text).width;
      cache.set(key, width);
    }
    return width;
  };
}
