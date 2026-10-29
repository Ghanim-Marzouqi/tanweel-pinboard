import { describe, expect, it, vi } from 'vitest';
import { assignedEmail, commentEmail, digestEmail, escapeHtml, passwordResetEmail } from '@/lib/email/templates';
import { isDigestTime, muscatClock } from '@/lib/email/digest';
import { retryDelayMs } from '@/lib/email/outbox';
import { hashToken } from '@/lib/password-reset';

vi.stubEnv('AUTH_URL', 'https://pinboard.tanweel.om');

const task = {
  id: 'task-1',
  title: '<script>alert(1)</script> Budget',
  projectName: 'Finance',
  priority: 'High' as const,
  dueDate: '2026-11-05',
};

describe('email templates', () => {
  it('escapes user content in HTML but keeps it readable in text', () => {
    const email = assignedEmail('sara@tanweel.om', 'en', 'Omar', task);
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.text).toContain('<script>alert(1)</script> Budget');
    expect(email.subject).toBe('Omar assigned you: <script>alert(1)</script> Budget');
  });

  it('links to the task on the public URL', () => {
    const email = assignedEmail('sara@tanweel.om', 'en', 'Omar', task);
    expect(email.html).toContain('href="https://pinboard.tanweel.om/tasks/task-1"');
    expect(email.text).toContain('https://pinboard.tanweel.om/tasks/task-1');
  });

  it('writes Arabic emails right-to-left', () => {
    const email = commentEmail('laila@tanweel.om', 'ar', 'mention', 'عمر', task, 'هل يمكنك المراجعة؟');
    expect(email.html).toContain('dir="rtl"');
    expect(email.subject).toContain('أشار إليك');
    expect(email.html).toContain('هل يمكنك المراجعة؟');
  });

  it('counts tasks in the summary subject', () => {
    const email = digestEmail('sara@tanweel.om', 'en', 'Sara', [task], [{ ...task, id: 'task-2', title: 'Call' }]);
    expect(email.subject).toBe('Your tasks for today (2)');
    expect(email.text).toContain('Overdue:');
    expect(email.text).toContain('Due today:');
  });

  it('includes the reset link', () => {
    const email = passwordResetEmail('sara@tanweel.om', 'en', 'sara', 'https://pinboard.tanweel.om/reset-password?token=abc');
    expect(email.html).toContain('href="https://pinboard.tanweel.om/reset-password?token=abc"');
  });

  it('escapes every HTML special character', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('morning summary schedule (Muscat time, Sunday–Thursday)', () => {
  it('reads the Muscat clock', () => {
    // 03:30 UTC = 07:30 in Muscat, Thursday 29 Oct 2026.
    expect(muscatClock(new Date('2026-10-29T03:30:00Z'))).toEqual({ hour: 7, weekday: 4 });
  });

  it('runs from 07:00 on work days only', () => {
    expect(isDigestTime(new Date('2026-10-29T03:00:00Z'), 7)).toBe(true); // Thu 07:00
    expect(isDigestTime(new Date('2026-10-29T02:59:00Z'), 7)).toBe(false); // Thu 06:59
    expect(isDigestTime(new Date('2026-10-30T05:00:00Z'), 7)).toBe(false); // Friday
    expect(isDigestTime(new Date('2026-10-31T05:00:00Z'), 7)).toBe(false); // Saturday
    expect(isDigestTime(new Date('2026-11-01T05:00:00Z'), 7)).toBe(true); // Sunday
  });
});

describe('outbox retries', () => {
  it('backs off exponentially from one minute', () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([60_000, 120_000, 240_000, 480_000, 960_000]);
  });
});

describe('password reset tokens', () => {
  it('stores a SHA-256 hex digest, never the token', () => {
    const hash = hashToken('example-token');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken('example-token'));
    expect(hash).not.toContain('example-token');
  });
});
