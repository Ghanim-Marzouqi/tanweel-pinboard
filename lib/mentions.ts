/** `@username` in comment text (usernames: lowercase letters, digits, . _ -). */
const MENTION_RE = /(^|[^\w@.])@([a-z0-9][a-z0-9._-]{2,63})/gi;

/** Unique, lower-cased usernames mentioned in `text`. */
export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_RE)) {
    // "@sara." at the end of a sentence means "sara".
    const name = match[2].toLowerCase().replace(/[._-]+$/, '');
    if (name.length >= 3) found.add(name);
  }
  return [...found];
}

/** Split text into plain parts and mention parts (for highlighting). */
export function splitMentions(text: string, known: Set<string>): { text: string; mention: boolean }[] {
  const parts: { text: string; mention: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_RE)) {
    const name = match[2].toLowerCase().replace(/[._-]+$/, '');
    if (!known.has(name)) continue;
    const start = match.index! + match[1].length;
    const end = start + 1 + name.length;
    if (start > last) parts.push({ text: text.slice(last, start), mention: false });
    parts.push({ text: text.slice(start, end), mention: true });
    last = end;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false });
  return parts;
}
