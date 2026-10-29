/**
 * Values derived from a task's rich-text description on every save: the
 * plain text (for search) and the checklist progress (for lists and cards).
 */
const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&amp;': '&',
};

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|lt|gt|quot|#39|amp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Counts Tiptap task-list items: `<li data-type="taskItem" data-checked="…">`. */
export function checklistProgress(html: string): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const [tag] of html.matchAll(/<li\b[^>]*>/g)) {
    if (!/data-type="taskItem"/.test(tag)) continue;
    total++;
    if (/data-checked="true"/.test(tag)) done++;
  }
  return { total, done };
}

export function descriptionFields(html: string) {
  const { total, done } = checklistProgress(html);
  return { descriptionText: htmlToText(html), checklistTotal: total, checklistDone: done };
}
