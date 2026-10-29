'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cx } from '@/lib/utils';

export interface MentionPerson {
  id: string;
  name: string;
  username: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  people: MentionPerson[];
  placeholder?: string;
  /** Ctrl/⌘ + Enter (when the suggestion list is closed). */
  onSubmit?: () => void;
  ariaLabel?: string;
}

/** The `@query` being typed just before the caret, if any. */
function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|\s)@([a-z0-9._-]*)$/i.exec(text.slice(0, caret));
  return match ? { start: caret - match[2].length - 1, query: match[2].toLowerCase() } : null;
}

/** Textarea that suggests project members after "@" and inserts "@username". */
export function MentionTextarea({ value, onChange, people, placeholder, onSubmit, ariaLabel }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  /** Where the caret goes once the inserted "@username " has rendered. */
  const caretAfterRender = useRef<number | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);

  // Runs before the browser handles the next keystroke, so fast typing
  // continues after the inserted name rather than at the end of the text.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caretAfterRender.current !== null) {
      el.setSelectionRange(caretAfterRender.current, caretAfterRender.current);
      caretAfterRender.current = null;
    }
  }, [value]);
  const [highlight, setHighlight] = useState(0);

  const suggestions = mention
    ? people
        .filter((p) => p.username.includes(mention.query) || p.name.toLowerCase().includes(mention.query))
        .slice(0, 6)
    : [];
  const open = suggestions.length > 0;

  function refresh(text: string, caret: number) {
    setMention(activeMention(text, caret));
    setHighlight(0);
  }

  function pick(person: MentionPerson) {
    const el = ref.current;
    if (!el || !mention) return;
    const caret = el.selectionStart;
    const inserted = `@${person.username} `;
    const next = value.slice(0, mention.start) + inserted + value.slice(caret);
    caretAfterRender.current = mention.start + inserted.length;
    onChange(next);
    setMention(null);
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        rows={3}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? 'mention-suggestions' : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          refresh(e.target.value, e.target.selectionStart);
        }}
        onClick={(e) => refresh(value, e.currentTarget.selectionStart)}
        onBlur={() => setMention(null)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const step = e.key === 'ArrowDown' ? 1 : -1;
              setHighlight((h) => (h + step + suggestions.length) % suggestions.length);
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              pick(suggestions[highlight]);
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setMention(null);
              return;
            }
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            onSubmit?.();
          }
        }}
      />
      {open && (
        <ul
          id="mention-suggestions"
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-[var(--shadow-md)] sm:inset-x-auto sm:min-w-64"
        >
          {suggestions.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === highlight}
              // Keep focus in the textarea while clicking.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className={cx(
                'flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-sm',
                i === highlight && 'bg-[color:var(--accent-soft)]',
              )}
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-[color:var(--text-faint)]">@{p.username}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
