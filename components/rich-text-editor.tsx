'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useLocale, useTranslations } from 'next-intl';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon } from 'lucide-react';
import { cx } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  ariaLabel?: string;
}

const noop = () => undefined;

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  readOnly,
  ariaLabel,
}: Props) {
  const locale = useLocale();
  const t = useTranslations('richText');
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const editor = useEditor(
    {
      extensions: [
        // Tiptap v3's StarterKit bundles Link, so disable it there and
        // register our own configured copy below — otherwise Tiptap warns
        // about a duplicate `link` extension. Text direction is provided
        // by Tiptap's built-in core extension; we drive it via commands.
        StarterKit.configure({
          heading: false,
          link: false,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        }),
      ],
      content: value || '',
      editable: !readOnly,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: 'tiptap',
          dir,
          'aria-label': ariaLabel || '',
          ...(placeholder ? { 'data-placeholder': placeholder } : {}),
        },
      },
      onUpdate: ({ editor: ed }) => {
        const html = ed.getHTML();
        onChange(html === '<p></p>' ? '' : html);
      },
    },
    [readOnly],
  );

  // Keep external value in sync (e.g. when loading an existing task)
  useEffect(() => {
    if (!editor) return;
    if ((editor.getHTML() || '') === (value || '')) return;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  // Update direction when locale changes
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: 'tiptap',
          dir,
          'aria-label': ariaLabel || '',
          ...(placeholder ? { 'data-placeholder': placeholder } : {}),
        },
      },
    });
    editor.view?.dom?.setAttribute('dir', dir);
  }, [dir, editor, ariaLabel, placeholder]);

  if (!editor) {
    return (
      <div
        className={cx(
          'min-h-32 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]',
          className,
        )}
      />
    );
  }

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t('linkPrompt'), previous ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div
      className={cx(
        'rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] focus-within:border-[color:var(--accent)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--accent)]',
        className,
      )}
    >
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border-b border-[color:var(--border)] px-2 py-1.5">
          <ToolbarButton
            label={t('bold')}
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            icon={<Bold size={16} />}
          />
          <ToolbarButton
            label={t('italic')}
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            icon={<Italic size={16} />}
          />
          <span className="mx-1 h-4 w-px bg-[color:var(--border)]" />
          <ToolbarButton
            label={t('bulletList')}
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            icon={<List size={16} />}
          />
          <ToolbarButton
            label={t('orderedList')}
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            icon={<ListOrdered size={16} />}
          />
          <span className="mx-1 h-4 w-px bg-[color:var(--border)]" />
          <ToolbarButton
            label={editor.isActive('link') ? t('removeLink') : t('link')}
            active={editor.isActive('link')}
            onClick={editor.isActive('link') ? () => editor.chain().focus().unsetLink().run() : setLink}
            icon={<LinkIcon size={16} />}
          />
        </div>
      )}
      <EditorContent editor={editor} onClick={editor.isFocused ? noop : () => editor.commands.focus()} />
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
          : 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]',
      )}
    >
      {icon}
    </button>
  );
}
