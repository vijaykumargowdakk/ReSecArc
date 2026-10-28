// Turns the device icons (plain React elements) into SVG text without react-dom, so the static
// renderer and the draw.io export can use the same silhouettes as the canvas.
import { Fragment, isValidElement, type ReactNode } from 'react';
import type { DeviceType } from '../model/schema';
import { ICONS, iconKey } from '../ui/icons';

export const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Attribute names React writes in camelCase that SVG also spells that way. */
const KEEP_CASE = new Set(['viewBox']);
const attrName = (name: string) => (name === 'className' ? 'class' : KEEP_CASE.has(name) ? name : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

/**
 * Serialises a tree of SVG elements. Function components are called directly, which suits the
 * icon helpers: they are plain functions of their props with no hooks. Attribute values found in
 * `values` are replaced, so theme variables can be swapped for fixed colours.
 */
export function toMarkup(node: ReactNode, values: Readonly<Record<string, string>> = {}): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return escapeXml(String(node));
  if (Array.isArray(node)) return node.map((n) => toMarkup(n as ReactNode, values)).join('');
  if (!isValidElement(node)) return '';
  const { children, ...props } = node.props as Record<string, unknown> & { children?: ReactNode };
  if (node.type === Fragment) return toMarkup(children, values);
  if (typeof node.type === 'function') return toMarkup((node.type as (p: unknown) => ReactNode)(node.props), values);
  if (typeof node.type !== 'string') return '';
  const attrs = Object.entries(props)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${attrName(k)}="${escapeXml(values[String(v)] ?? String(v))}"`)
    .join('');
  const inner = toMarkup(children, values);
  return inner ? `<${node.type}${attrs}>${inner}</${node.type}>` : `<${node.type}${attrs}/>`;
}

export interface IconColors {
  ink: string;
  fill: string;
  badge: string;
}

/** The shapes of a device kind's icon, on its 32×32 grid, with fixed colours. */
export function iconBody(type: DeviceType, variant: string, colors: IconColors): string {
  return toMarkup(ICONS[iconKey(type, variant)], {
    'var(--icon-fill)': colors.fill,
    'var(--icon-badge-bg, #fff)': colors.badge,
    currentColor: colors.ink,
  });
}

/** Presentation attributes every icon is drawn with, as on the canvas. */
export const iconAttrs = (colors: IconColors) => `fill="none" stroke="${colors.ink}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;

/** A device kind's icon as a standalone SVG document. */
export function iconSvg(type: DeviceType, variant: string, colors: IconColors, size = 32): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" ${iconAttrs(colors)}>${iconBody(type, variant, colors)}</svg>`;
}
