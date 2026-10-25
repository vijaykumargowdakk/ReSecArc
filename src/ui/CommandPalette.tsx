import { useReactFlow } from '@xyflow/react';
import { Command as CommandIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CanvasEdge } from './canvas/edges';
import type { CanvasNode } from './canvas/nodes';
import { buildCommands, filterCommands, type CommandContext } from './commands';

/** Ctrl+Shift+P: run any command by typing part of its name. Arrow keys choose, Enter runs. */
export function CommandPalette({ ctx, onClose }: { ctx: CommandContext; onClose: () => void }) {
  const rf = useReactFlow<CanvasNode, CanvasEdge>();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // Built once on open: each command reads the current state again when it runs.
  const commands = useMemo(() => buildCommands(ctx, rf), [ctx, rf]);
  const matches = useMemo(() => filterCommands(commands, query), [commands, query]);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (index: number) => {
    const command = matches[index];
    if (!command) return;
    onClose();
    command.run();
  };

  return (
    <dialog ref={dialog} className="search command-palette" aria-label="Command palette" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()}>
      <div className="search__box">
        <CommandIcon size={16} aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          value={query}
          placeholder="Type a command, e.g. “export csv”, “dark”, “tidy”…"
          aria-label="Command"
          aria-controls="command-results"
          aria-activedescendant={matches[active] ? `command-${matches[active].id}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, matches.length - 1));
            else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
            else if (e.key === 'Home') setActive(0);
            else if (e.key === 'End') setActive(Math.max(0, matches.length - 1));
            else if (e.key === 'Enter') run(active);
            else return;
            e.preventDefault();
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <ul id="command-results" ref={list} role="listbox" aria-label="Commands" className="search__results">
        {matches.map((c, i) => (
          <li
            key={c.id}
            id={`command-${c.id}`}
            role="option"
            aria-selected={i === active}
            className={i === active ? 'is-active' : ''}
            onMouseEnter={() => setActive(i)}
            onClick={() => run(i)}
          >
            <span className="command-palette__group">{c.group}</span>
            <span className="search__label">{c.label}</span>
            {c.shortcut && <kbd>{c.shortcut}</kbd>}
          </li>
        ))}
        {matches.length === 0 && <li className="search__none muted">No command matches “{query}”.</li>}
      </ul>
    </dialog>
  );
}
