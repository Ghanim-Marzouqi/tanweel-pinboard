import { createTranslator } from 'next-intl';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import { formatDueDate } from '@/lib/dates';
import { appUrl, type OutgoingEmail } from '@/lib/email/transport';

export type EmailLocale = 'en' | 'ar';

const MESSAGES = { en, ar } as const;

export function emailLocale(value: string | null | undefined): EmailLocale {
  return value === 'ar' ? 'ar' : 'en';
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function translator(locale: EmailLocale) {
  return createTranslator({ locale, messages: MESSAGES[locale] });
}

const ACCENT = '#8851f5';

/** Shared HTML shell: brand header, content, footer; RTL for Arabic. */
function layout(locale: EmailLocale, bodyHtml: string): string {
  const t = translator(locale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const font =
    locale === 'ar' ? "Tahoma, 'Segoe UI', Arial, sans-serif" : "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<body style="margin:0;padding:24px;background:#f8f8f6;font-family:${font};color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e0;border-radius:12px;overflow:hidden;" dir="${dir}">
    <div style="background:${ACCENT};color:#ffffff;padding:14px 20px;font-size:17px;font-weight:bold;">${escapeHtml(t('app.brand'))}</div>
    <div style="padding:20px;font-size:15px;line-height:1.6;text-align:${dir === 'rtl' ? 'right' : 'left'};">${bodyHtml}</div>
  </div>
  <p style="max-width:560px;margin:12px auto 0;font-size:12px;color:#8a847d;text-align:center;">${escapeHtml(t('email.footer'))}</p>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0 4px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold;">${escapeHtml(label)}</a></p>`;
}

export interface TaskInfo {
  id: string;
  title: string;
  projectName: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  dueDate: string | null;
}

function taskDetails(locale: EmailLocale, task: TaskInfo): { html: string; text: string } {
  const t = translator(locale);
  const rows: [string, string][] = [
    [t('email.project'), task.projectName],
    [t('email.priority'), t(`tasks.priority.${task.priority.toLowerCase()}` as 'tasks.priority.low')],
  ];
  if (task.dueDate) rows.push([t('email.due'), formatDueDate(task.dueDate, locale)]);
  return {
    html:
      `<p style="margin:12px 0 4px;font-size:17px;font-weight:bold;">${escapeHtml(task.title)}</p>` +
      `<table style="border-collapse:collapse;font-size:14px;color:#57534e;">` +
      rows.map(([k, v]) => `<tr><td style="padding:2px 0;padding-inline-end:12px;">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('') +
      `</table>`,
    text: [task.title, ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n'),
  };
}

function taskUrl(id: string) {
  return `${appUrl()}/tasks/${id}`;
}

function quote(body: string): string {
  return `<blockquote style="margin:12px 0;padding:10px 14px;background:#f4f4f1;border-radius:8px;white-space:pre-wrap;">${escapeHtml(body)}</blockquote>`;
}

export function assignedEmail(to: string, locale: EmailLocale, actor: string, task: TaskInfo): OutgoingEmail {
  const t = translator(locale);
  const details = taskDetails(locale, task);
  const url = taskUrl(task.id);
  return {
    to,
    subject: t('email.assigned.subject', { actor, title: task.title }),
    html: layout(locale, `<p>${escapeHtml(t('email.assigned.intro', { actor }))}</p>${details.html}${button(url, t('email.openTask'))}`),
    text: `${t('email.assigned.intro', { actor })}\n\n${details.text}\n\n${url}`,
  };
}

export function commentEmail(
  to: string,
  locale: EmailLocale,
  kind: 'mention' | 'comment',
  actor: string,
  task: TaskInfo,
  body: string,
): OutgoingEmail {
  const t = translator(locale);
  const url = taskUrl(task.id);
  const intro = t(`email.${kind}.intro`, { actor });
  return {
    to,
    subject: t(`email.${kind}.subject`, { actor, title: task.title }),
    html: layout(
      locale,
      `<p>${escapeHtml(intro)}</p>${quote(body)}<p style="color:#57534e;font-size:14px;">${escapeHtml(task.title)} · ${escapeHtml(task.projectName)}</p>${button(url, t('email.openTask'))}`,
    ),
    text: `${intro}\n\n${body}\n\n${task.title} · ${task.projectName}\n${url}`,
  };
}

export function digestEmail(
  to: string,
  locale: EmailLocale,
  name: string,
  overdue: TaskInfo[],
  today: TaskInfo[],
): OutgoingEmail {
  const t = translator(locale);
  const section = (title: string, tasks: TaskInfo[], color: string) =>
    tasks.length === 0
      ? ''
      : `<p style="margin:18px 0 6px;font-weight:bold;color:${color};">${escapeHtml(title)} (${tasks.length})</p><ul style="margin:0;padding-inline-start:20px;">` +
        tasks
          .map(
            (task) =>
              `<li style="margin:4px 0;"><a href="${escapeHtml(taskUrl(task.id))}" style="color:#1c1917;">${escapeHtml(task.title)}</a> <span style="color:#8a847d;">· ${escapeHtml(task.projectName)}${task.dueDate ? ` · ${escapeHtml(formatDueDate(task.dueDate, locale))}` : ''}</span></li>`,
          )
          .join('') +
        `</ul>`;
  const textSection = (title: string, tasks: TaskInfo[]) =>
    tasks.length === 0 ? '' : `${title}:\n${tasks.map((x) => `- ${x.title} (${x.projectName}) ${taskUrl(x.id)}`).join('\n')}\n\n`;
  const count = overdue.length + today.length;
  return {
    to,
    subject: t('email.digest.subject', { count }),
    html: layout(
      locale,
      `<p>${escapeHtml(t('email.digest.intro', { name }))}</p>` +
        section(t('email.digest.overdue'), overdue, '#b91c1c') +
        section(t('email.digest.today'), today, '#1c1917') +
        button(`${appUrl()}/`, t('email.digest.openMyTasks')) +
        `<p style="color:#8a847d;font-size:13px;">${escapeHtml(t('email.digest.settingsHint'))}</p>`,
    ),
    text:
      `${t('email.digest.intro', { name })}\n\n` +
      textSection(t('email.digest.overdue'), overdue) +
      textSection(t('email.digest.today'), today) +
      `${appUrl()}/\n\n${t('email.digest.settingsHint')}`,
  };
}

export function passwordResetEmail(to: string, locale: EmailLocale, username: string, link: string): OutgoingEmail {
  const t = translator(locale);
  return {
    to,
    subject: t('email.reset.subject'),
    html: layout(
      locale,
      `<p>${escapeHtml(t('email.reset.intro', { username }))}</p>${button(link, t('email.reset.button'))}` +
        `<p style="color:#57534e;font-size:14px;">${escapeHtml(t('email.reset.expiry'))}</p>` +
        `<p style="color:#8a847d;font-size:13px;">${escapeHtml(t('email.reset.ignore'))}</p>`,
    ),
    text: `${t('email.reset.intro', { username })}\n\n${link}\n\n${t('email.reset.expiry')}\n${t('email.reset.ignore')}`,
  };
}

export function testEmail(to: string, locale: EmailLocale, name: string): OutgoingEmail {
  const t = translator(locale);
  return {
    to,
    subject: t('email.test.subject'),
    html: layout(locale, `<p>${escapeHtml(t('email.test.intro', { name }))}</p>`),
    text: t('email.test.intro', { name }),
  };
}
